/**
 * RNNoise, the recurrent-network noise suppressor from Xiph, running in an AudioWorklet.
 * It ships with the client as a WebAssembly asset and runs on this device only: nothing
 * about the microphone leaves the browser for it. This is the "self-hosted" answer to
 * the cloud suppressors Discord licenses.
 *
 * RNNoise works on 10 ms frames at 48 kHz, so the AudioContext it runs in must be created
 * at that rate (see stores/voice.ts). The worklet buffers the 128-sample render quanta
 * into 480-sample frames, which adds about 27 ms of latency to the microphone.
 */

import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseWasmSimdUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

/** The only sample rate RNNoise's model is trained for. */
export const RNNOISE_SAMPLE_RATE = 48_000;

let wasmBinary: Promise<ArrayBuffer> | null = null;
/**
 * Worklet registration per context, kept as the *promise* rather than a "done" flag:
 * registering the same processor name twice in one AudioWorkletGlobalScope throws, so two
 * pipelines built at the same time (which happens whenever a setting changes mid-call)
 * must share one `addModule` call instead of racing into a duplicate registration. A
 * failed registration is forgotten so a later attempt can retry.
 */
const workletReady = new WeakMap<AudioContext, Promise<void>>();

function ensureWorklet(ctx: AudioContext): Promise<void> {
  let ready = workletReady.get(ctx);
  if (!ready) {
    ready = ctx.audioWorklet.addModule(rnnoiseWorkletUrl).catch((err: unknown) => {
      workletReady.delete(ctx);
      throw err;
    });
    workletReady.set(ctx, ready);
  }
  return ready;
}

export function rnnoiseSupported(ctx: AudioContext): boolean {
  return typeof AudioWorkletNode === 'function' && !!ctx.audioWorklet && ctx.sampleRate === RNNOISE_SAMPLE_RATE;
}

/**
 * A denoising node for `ctx`: connect the microphone into it and read the clean signal
 * from its output. Throws when the context cannot host it (wrong rate, no worklets).
 */
export async function createRnnoiseNode(ctx: AudioContext): Promise<RnnoiseWorkletNode> {
  if (!rnnoiseSupported(ctx)) throw new Error(`RNNoise needs a ${RNNOISE_SAMPLE_RATE} Hz AudioContext with AudioWorklet`);
  // The SIMD build is picked when the browser can run it; one fetch per page.
  wasmBinary ??= loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseWasmSimdUrl }).catch((err) => {
    wasmBinary = null;
    throw err;
  });
  const [binary] = await Promise.all([wasmBinary, ensureWorklet(ctx)]);
  // Voice is mono; the pipeline downmixes before this node.
  return new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: binary });
}
