/**
 * Microphone pipeline: getUserMedia -> input gain -> noise suppression -> level meter ->
 * gate -> the track we publish. The gate is what push-to-talk, the sensitivity threshold
 * and self-mute drive: opening and closing it is a gain ramp, not a track replace, so a
 * key press transmits within a few milliseconds and nothing is renegotiated. LiveKit
 * sees one steady track that is digital silence whenever the gate is shut.
 *
 * Noise suppression is RNNoise in an AudioWorklet (lib/voice/rnnoise.ts) unless the
 * settings ask for the browser's own or none. The level meter sits after it, so what
 * the meter and the voice-activity threshold see is the cleaned signal.
 */

import { createRnnoiseNode, RNNOISE_SAMPLE_RATE } from './rnnoise';
import type { NoiseSuppressionMode } from '../../stores/voiceSettings';

export interface MicPipelineOptions {
  constraints: MediaTrackConstraints;
  /** 0..2 (100% = 1). */
  inputGain: number;
  noiseSuppression: NoiseSuppressionMode;
  /**
   * The context to build in. The call's context is created inside the join click (so
   * browsers that gate audio on a gesture let it run) and shared with playback; when
   * omitted a private 48 kHz context is created and closed with the pipeline.
   */
  context?: AudioContext;
  /** Called ~25 times a second with the current input level in dBFS (-100..0). */
  onLevel?: (db: number) => void;
}

export interface MicPipeline {
  /** The processed audio track to publish. */
  track: MediaStreamTrack;
  /** The raw device track (for device labels / ended detection). */
  source: MediaStreamTrack;
  /** Which suppressor is actually running (RNNoise falls back to the browser's when the context can't host it). */
  noiseSuppression: NoiseSuppressionMode;
  setInputGain(gain: number): void;
  /** Open = transmit, closed = silence. Ramped over 10 ms. */
  setOpen(open: boolean): void;
  isOpen(): boolean;
  /** Latest measured input level in dBFS, after suppression, before the gate. */
  level(): number;
  close(): void;
}

const LEVEL_INTERVAL_MS = 40;

/** A context RNNoise can run in; `sampleRate` is honoured by every current browser. */
export function createVoiceAudioContext(): AudioContext {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error('Web Audio unavailable');
  try {
    return new Ctx({ sampleRate: RNNOISE_SAMPLE_RATE, latencyHint: 'interactive' });
  } catch {
    return new Ctx({ latencyHint: 'interactive' });
  }
}

export async function createMicPipeline(opts: MicPipelineOptions): Promise<MicPipeline> {
  const constraints: MediaTrackConstraints = { ...opts.constraints };
  let noiseSuppression = opts.noiseSuppression;
  const ownsContext = !opts.context;
  const ctx = opts.context ?? createVoiceAudioContext();
  if (noiseSuppression === 'rnnoise' && ctx.sampleRate !== RNNOISE_SAMPLE_RATE) {
    // The browser refused a 48 kHz context: fall back rather than run the model on the
    // wrong rate (it would still "work", as a bad vocoder).
    noiseSuppression = 'browser';
    constraints.noiseSuppression = true;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  const source = stream.getAudioTracks()[0];
  if (!source) {
    stream.getTracks().forEach((t) => t.stop());
    if (ownsContext) void ctx.close();
    throw new Error('no audio track');
  }

  const input = ctx.createMediaStreamSource(stream);
  const inputGain = ctx.createGain();
  // Voice is mono; a stereo microphone is downmixed here so every later stage (RNNoise
  // above all) works on one channel.
  inputGain.channelCount = 1;
  inputGain.channelCountMode = 'explicit';
  inputGain.gain.value = clampGain(opts.inputGain);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.2;
  const gate = ctx.createGain();
  gate.gain.value = 0;
  const dest = ctx.createMediaStreamDestination();

  let denoiser: AudioNode | null = null;
  if (noiseSuppression === 'rnnoise') {
    try {
      denoiser = await createRnnoiseNode(ctx);
    } catch (err) {
      console.warn('[voice] RNNoise unavailable, using the browser suppressor', err);
      noiseSuppression = 'browser';
      await source.applyConstraints({ ...constraints, noiseSuppression: true }).catch(() => undefined);
    }
  }

  input.connect(inputGain);
  const cleaned = denoiser ? inputGain.connect(denoiser) : inputGain;
  cleaned.connect(analyser);
  cleaned.connect(gate);
  gate.connect(dest);

  const buf = new Float32Array(analyser.fftSize);
  let currentDb = -100;
  let open = false;
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sum / buf.length);
    currentDb = Math.max(-100, 20 * Math.log10(Math.max(rms, 1e-5)));
    opts.onLevel?.(currentDb);
  }, LEVEL_INTERVAL_MS);

  const out = dest.stream.getAudioTracks()[0]!;
  return {
    track: out,
    source,
    noiseSuppression,
    setInputGain(g) {
      inputGain.gain.setTargetAtTime(clampGain(g), ctx.currentTime, 0.02);
    },
    setOpen(next) {
      if (open === next) return;
      open = next;
      gate.gain.cancelScheduledValues(ctx.currentTime);
      gate.gain.setTargetAtTime(next ? 1 : 0, ctx.currentTime, 0.005);
    },
    isOpen: () => open,
    level: () => currentDb,
    close() {
      window.clearInterval(timer);
      try {
        input.disconnect();
        inputGain.disconnect();
        denoiser?.disconnect();
        analyser.disconnect();
        gate.disconnect();
      } catch {
        /* already torn down */
      }
      (denoiser as { destroy?: () => void } | null)?.destroy?.();
      stream.getTracks().forEach((t) => t.stop());
      out.stop();
      if (ownsContext) void ctx.close();
    },
  };
}

function clampGain(g: number): number {
  return Number.isFinite(g) ? Math.min(2, Math.max(0, g)) : 1;
}

/**
 * Voice-activity gate: opens when the level clears the threshold and stays open for a
 * hangover after it drops, so word gaps don't chop. `auto` mode is permissive - it
 * leaves the gate open and relies on the noise suppressor, which is what the automatic
 * setting means on Discord too.
 */
export function createVadGate(opts: { hangoverMs?: number } = {}) {
  const hangover = opts.hangoverMs ?? 400;
  let lastAbove = 0;
  return {
    /** Feed a level; returns whether the gate should be open now. */
    update(db: number, thresholdDb: number, auto: boolean, now = Date.now()): boolean {
      if (auto) return true;
      if (db >= thresholdDb) {
        lastAbove = now;
        return true;
      }
      return now - lastAbove < hangover;
    },
    reset() {
      lastAbove = 0;
    },
  };
}
