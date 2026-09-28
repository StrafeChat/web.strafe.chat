/**
 * Voice & video preferences (per device, localStorage). Nothing here opens a stream on
 * its own; the settings page uses these when testing the microphone / camera, and the
 * voice store (stores/voice.ts) reads them for its constraints, input mode and levels.
 */

import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_voice';

export type VoiceInputMode = 'vad' | 'ptt';

/**
 * `rnnoise`: the RNNoise neural suppressor, bundled with the client and run in an
 * AudioWorklet on this device (nothing leaves the browser). `browser`: whatever the
 * browser's own getUserMedia noise suppression does. `off`: neither.
 */
export type NoiseSuppressionMode = 'rnnoise' | 'browser' | 'off';

/** Screen share height, or `source` for whatever the picked window/display actually is. */
export type ScreenShareResolution = '720' | '1080' | '1440' | 'source';
export type ScreenShareFps = 15 | 30 | 60;

export const SCREEN_SHARE_RESOLUTIONS: ScreenShareResolution[] = ['720', '1080', '1440', 'source'];
export const SCREEN_SHARE_FPS: ScreenShareFps[] = [15, 30, 60];

export interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  cameraDeviceId: string;
  /** 0..200 (percent). Both are gains, so a boost is possible. */
  inputVolume: number;
  outputVolume: number;
  /** Automatic sensitivity vs. a manual threshold in dBFS (-100..0). */
  autoSensitivity: boolean;
  sensitivityDb: number;
  echoCancellation: boolean;
  noiseSuppression: NoiseSuppressionMode;
  /** Which suppressor the in-call toggle turns back *on*. Tracks the last one chosen in
   * settings, so flipping the toggle never silently changes which engine you use. */
  noiseSuppressionPreferred: Exclude<NoiseSuppressionMode, 'off'>;
  autoGainControl: boolean;
  /** Screen share quality, picked per share but remembered as the default. */
  screenShareResolution: ScreenShareResolution;
  screenShareFps: ScreenShareFps;
  /** Voice activity (transmit when you speak) or push to talk (hold a key). */
  inputMode: VoiceInputMode;
  /** Push-to-talk combo in the keybinds format ("Ctrl+Space", "`"). Empty = unbound. */
  pttKey: string;
  /** How long to keep transmitting after the key is released, ms (0..2000). */
  pttReleaseMs: number;
  /** Mirror your own camera preview (does not affect what others see). */
  mirrorCamera: boolean;
}

const DEFAULTS: VoiceSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  cameraDeviceId: '',
  inputVolume: 100,
  outputVolume: 100,
  autoSensitivity: true,
  sensitivityDb: -50,
  echoCancellation: true,
  noiseSuppression: 'rnnoise',
  noiseSuppressionPreferred: 'rnnoise',
  autoGainControl: true,
  // 1080p30 matches what Discord gives without a paid tier, and is the point where most
  // uplinks still keep up.
  screenShareResolution: '1080',
  screenShareFps: 30,
  inputMode: 'vad',
  pttKey: '`',
  pttReleaseMs: 200,
  mirrorCamera: true,
};

function clamp(v: unknown, lo: number, hi: number, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
}

/** The setting was a boolean (browser suppression on/off) before RNNoise arrived. */
function noiseMode(v: unknown): NoiseSuppressionMode {
  if (v === 'rnnoise' || v === 'browser' || v === 'off') return v;
  if (v === false) return 'off';
  return DEFAULTS.noiseSuppression;
}

function load(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<VoiceSettings>;
      return {
        inputDeviceId: typeof p.inputDeviceId === 'string' ? p.inputDeviceId : '',
        outputDeviceId: typeof p.outputDeviceId === 'string' ? p.outputDeviceId : '',
        cameraDeviceId: typeof p.cameraDeviceId === 'string' ? p.cameraDeviceId : '',
        inputVolume: clamp(p.inputVolume, 0, 200, DEFAULTS.inputVolume),
        outputVolume: clamp(p.outputVolume, 0, 200, DEFAULTS.outputVolume),
        autoSensitivity: p.autoSensitivity ?? DEFAULTS.autoSensitivity,
        sensitivityDb: clamp(p.sensitivityDb, -100, 0, DEFAULTS.sensitivityDb),
        echoCancellation: p.echoCancellation ?? DEFAULTS.echoCancellation,
        noiseSuppression: noiseMode(p.noiseSuppression),
        noiseSuppressionPreferred:
          p.noiseSuppressionPreferred === 'browser' || p.noiseSuppressionPreferred === 'rnnoise'
            ? p.noiseSuppressionPreferred
            : DEFAULTS.noiseSuppressionPreferred,
        screenShareResolution: SCREEN_SHARE_RESOLUTIONS.includes(p.screenShareResolution as ScreenShareResolution)
          ? (p.screenShareResolution as ScreenShareResolution)
          : DEFAULTS.screenShareResolution,
        screenShareFps: SCREEN_SHARE_FPS.includes(p.screenShareFps as ScreenShareFps)
          ? (p.screenShareFps as ScreenShareFps)
          : DEFAULTS.screenShareFps,
        autoGainControl: p.autoGainControl ?? DEFAULTS.autoGainControl,
        inputMode: p.inputMode === 'ptt' ? 'ptt' : 'vad',
        pttKey: typeof p.pttKey === 'string' ? p.pttKey : DEFAULTS.pttKey,
        pttReleaseMs: clamp(p.pttReleaseMs, 0, 2000, DEFAULTS.pttReleaseMs),
        mirrorCamera: p.mirrorCamera ?? DEFAULTS.mirrorCamera,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export const [voiceSettings, setVoiceSettingsStore] = createStore<VoiceSettings>(load());

export function setVoiceSettings(patch: Partial<VoiceSettings>): void {
  // Choosing a suppressor in settings is also what the in-call toggle should restore.
  if (patch.noiseSuppression && patch.noiseSuppression !== 'off') {
    patch = { ...patch, noiseSuppressionPreferred: patch.noiseSuppression };
  }
  setVoiceSettingsStore(patch);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...voiceSettings }));
  } catch {
    /* ignore */
  }
}

/**
 * Audio constraints for getUserMedia built from the current settings. The browser's own
 * noise suppression is only asked for in `browser` mode: RNNoise wants the unprocessed
 * signal it was trained on, and two suppressors in a row eat consonants.
 */
export function audioConstraints(): MediaTrackConstraints {
  return {
    ...(voiceSettings.inputDeviceId ? { deviceId: { ideal: voiceSettings.inputDeviceId } } : {}),
    echoCancellation: voiceSettings.echoCancellation,
    noiseSuppression: voiceSettings.noiseSuppression === 'browser',
    autoGainControl: voiceSettings.autoGainControl,
  };
}

export function videoConstraints(): MediaTrackConstraints {
  return {
    ...(voiceSettings.cameraDeviceId ? { deviceId: { ideal: voiceSettings.cameraDeviceId } } : {}),
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}
