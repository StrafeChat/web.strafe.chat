import { voiceMessageFilename } from './attachments/format';
import { bareMediaType, readHead, sniffClipFormat } from './media/clipFormat';
import type { ClipFormat } from './media/clipFormat';

/**
 * Voice-message recording. Deliberately independent of Solid and of the composer: this is
 * the part that touches getUserMedia/MediaRecorder, so it stays a plain object the UI
 * drives and disposes of.
 *
 * Why a filename and not a flag: the messages API has no flag bit, so a recorded clip is
 * just an audio attachment named `voice-message.<ext>` (see lib/attachments/format.ts).
 * That keeps the whole existing pipeline - queue, upload progress, E2EE encryption,
 * optimistic preview - working untouched, and older clients degrade to a normal audio
 * attachment.
 */

/** Longest clip we let someone record, matching the cap the composer enforces. */
export const VOICE_MESSAGE_MAX_MS = 5 * 60 * 1000;

/** Below this the clip is treated as a mis-click and thrown away rather than sent. */
export const VOICE_MESSAGE_MIN_MS = 500;

/** How often we sample the input level for the live waveform. */
const SAMPLE_MS = 50;

/**
 * Containers to try, best first. Opus-in-WebM is what Chrome/Edge record and every
 * mainstream browser decodes; Safari only offers MP4; older Firefox offers Opus-in-Ogg.
 *
 * Order matters for interop, not just preference: Opus-in-Ogg is a Firefox-only outcome on
 * the desktop, and a clip in it is the one recording shape that regularly reaches a recipient
 * whose browser sniffs the container and gives up. So WebM is asked for first and MP4 is
 * preferred over Ogg - an MP4 clip plays everywhere, an Ogg one does not.
 */
const CONTAINERS: ReadonlyArray<{ mime: string; ext: string }> = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/mp4', ext: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
];



export type VoiceRecorderErrorReason = 'unsupported' | 'denied' | 'unavailable' | 'failed' | 'tooShort';

export class VoiceRecorderError extends Error {
  readonly reason: VoiceRecorderErrorReason;
  constructor(reason: VoiceRecorderErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'VoiceRecorderError';
    this.reason = reason;
  }
}

export interface VoiceRecording {
  /** Named `voice-message.<ext>` so the renderer recognises it as a voice message. */
  file: File;
  durationMs: number;
}

export interface VoiceRecorderHandle {
  /** Milliseconds captured so far. */
  elapsedMs(): number;
  /** Input level per ~50ms sample, oldest first, each 0..1. Drives the live waveform. */
  levels(): number[];
  /** Finish and return the clip. Resolves null if the clip was too short to keep. */
  stop(): Promise<VoiceRecording | null>;
  /** Throw the recording away. Safe to call after stop(). */
  cancel(): void;
}

/** Whether this browser can record at all. False in insecure contexts (getUserMedia is
 *  gated to https and localhost) and where MediaRecorder is missing. */
export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder === 'function' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickContainer(): { mime: string; format: ClipFormat } {
  for (const c of CONTAINERS) {
    try {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        return { mime: c.mime, format: { ext: c.ext, type: bareMediaType(c.mime, `audio/${c.ext === 'm4a' ? 'mp4' : c.ext}`) } };
      }
    } catch {
      // isTypeSupported is absent on some older Safari builds; fall through.
    }
  }
  // Let the browser choose and infer the extension from what it reports back.
  return { mime: '', format: { ext: 'webm', type: 'audio/webm' } };
}

/**
 * The format of the finished clip: what the bytes say, with the recorder's own report as a
 * fallback. Always prefer the sniffed container - see `sniffFormat`.
 */
async function formatFor(recorder: MediaRecorder, chunks: Blob[], fallback: ClipFormat): Promise<ClipFormat> {
  const first = chunks.find((c) => c.size > 0);
  const sniffed = first ? sniffClipFormat(await readHead(first)) : null;
  if (sniffed) return sniffed;
  const type = (recorder.mimeType || '').toLowerCase();
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('webm') ? 'webm' : fallback.ext;
  return { ext, type: bareMediaType(recorder.mimeType, `audio/${ext === 'm4a' ? 'mp4' : ext}`) };
}

/** Drop the mic and close the graph after a failure, when there is no recorder to stop. */
function releaseMedia(stream: MediaStream | null, ctx: AudioContext | null): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
  void ctx?.close().catch(() => undefined);
}

/** Constructing the recorder throws synchronously on some builds; never leak the mic. */
function openRecorder(stream: MediaStream, ctx: AudioContext | null, mime: string): MediaRecorder {
  try {
    return new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (err) {
    releaseMedia(stream, ctx);
    throw new VoiceRecorderError('failed', err instanceof Error ? err.message : undefined);
  }
}

/**
 * Request the microphone and start capturing. Must be called from the click that starts
 * the recording: getUserMedia needs a user gesture, and the AudioContext has to be
 * created synchronously here or Safari hands back a suspended one and the live waveform
 * stays flat.
 */
export async function startVoiceRecording(): Promise<VoiceRecorderHandle> {
  if (!isVoiceRecordingSupported()) {
    throw new VoiceRecorderError('unsupported');
  }

  // Created before the first await on purpose - see the note above.
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = AudioCtx ? new AudioCtx() : null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    releaseMedia(null, ctx);
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new VoiceRecorderError('denied');
    }
    if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'AbortError') {
      throw new VoiceRecorderError('unavailable');
    }
    throw new VoiceRecorderError('failed', err instanceof Error ? err.message : undefined);
  }

  const container = pickContainer();
  const recorder = openRecorder(stream, ctx, container.mime);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Live level metering, off the same graph the call recorder uses.
  const levels: number[] = [];
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let tap: GainNode | null = null;
  if (ctx) {
    try {
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      // The analyser has to reach the destination for the graph to be pulled, but the
      // microphone must never reach the speakers - a zero gain keeps the metering live
      // without the sender hearing their own voice echo.
      tap = ctx.createGain();
      tap.gain.value = 0;
      source.connect(analyser);
      analyser.connect(tap);
      tap.connect(ctx.destination);
    } catch {
      analyser = null;
      source = null;
      tap = null;
    }
  }
  void ctx?.resume().catch(() => undefined);
  const samples = analyser ? new Uint8Array(analyser.fftSize) : null;

  const startedAt = performance.now();
  let frozenMs: number | null = null;
  const timer = window.setInterval(() => {
    if (!analyser || !samples) return;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = (samples[i]! - 128) / 128;
      sum += v * v;
    }
    // RMS, lifted and curved so quiet speech still moves the bars.
    const rms = Math.sqrt(sum / samples.length);
    levels.push(Math.min(1, Math.pow(rms * 3.2, 0.7)));
  }, SAMPLE_MS);

  let stopped = false;
  const teardown = () => {
    frozenMs = performance.now() - startedAt;
    window.clearInterval(timer);
    try {
      source?.disconnect();
      analyser?.disconnect();
      tap?.disconnect();
    } catch {
      /* already torn down */
    }
    for (const track of stream.getTracks()) track.stop();
    void ctx?.close().catch(() => undefined);
  };

  const handle: VoiceRecorderHandle = {
    elapsedMs: () => frozenMs ?? performance.now() - startedAt,

    levels: () => levels,
    stop: () =>
      new Promise<VoiceRecording | null>((resolve, reject) => {
        if (stopped) {
          resolve(null);
          return;
        }
        stopped = true;
        recorder.onstop = () => {
          teardown();
          const durationMs = Math.min(performance.now() - startedAt, VOICE_MESSAGE_MAX_MS);
          if (durationMs < VOICE_MESSAGE_MIN_MS || chunks.length === 0) {
            resolve(null);
            return;
          }
          // Name the clip after what the recorder actually wrote, not what it said it would
          // write - see sniffFormat. The upload's Content-Type follows the same value, so the
          // name and the bytes it describes can never drift apart in transit.
          void formatFor(recorder, chunks, container.format)
            .then((format) => {
              const file = new File(chunks, voiceMessageFilename(format.ext), { type: format.type });
              resolve({ file, durationMs });
            })
            .catch(() => resolve(null));
        };
        recorder.onerror = () => {
          teardown();
          reject(new VoiceRecorderError('failed'));
        };
        try {
          recorder.stop();
        } catch (err) {
          teardown();
          reject(new VoiceRecorderError('failed', err instanceof Error ? err.message : undefined));
        }
      }),
    cancel: () => {
      if (stopped) return;
      stopped = true;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopping */
      }
      teardown();
    },
  };

  recorder.start(SAMPLE_MS);
  return handle;
}
