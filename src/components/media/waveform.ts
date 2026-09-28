/**
 * Waveform peaks for the audio player: the file is decoded once (off the main audio
 * graph, through an OfflineAudioContext, so no user gesture is needed) and reduced to a
 * fixed number of bars. Cached per URL for the session; large files are skipped because
 * decoding expands compressed audio to ~10 MB of PCM per minute.
 */
export const WAVEFORM_BARS = 72;
const MAX_DECODE_BYTES = 12 * 1024 * 1024;

const cache = new Map<string, Promise<number[] | null>>();

export function waveformPeaks(url: string, sizeBytes: number): Promise<number[] | null> {
  if (sizeBytes > MAX_DECODE_BYTES) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    p = decodePeaks(url).catch(() => null);
    p.then((peaks) => {
      if (!peaks) cache.delete(url);
    });
    cache.set(url, p);
  }
  return p;
}

async function decodePeaks(url: string): Promise<number[] | null> {
  if (typeof OfflineAudioContext === 'undefined') return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = await res.arrayBuffer();
  // A 1-frame offline context is enough to decode; it never renders anything.
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const audio = await ctx.decodeAudioData(bytes);
  return reduceToPeaks(audio, WAVEFORM_BARS);
}

/** Mix channels, take the peak absolute sample per bar, normalise to 0..1. */
export function reduceToPeaks(audio: AudioBuffer, bars: number): number[] {
  const length = audio.length;
  if (length === 0) return new Array(bars).fill(0);
  const channels: Float32Array[] = [];
  for (let c = 0; c < audio.numberOfChannels; c++) channels.push(audio.getChannelData(c));
  const perBar = length / bars;
  const peaks = new Array<number>(bars).fill(0);
  // Sample at most ~2000 points per bar; peak detection doesn't need every frame.
  const stride = Math.max(1, Math.floor(perBar / 2000));
  for (let b = 0; b < bars; b++) {
    const start = Math.floor(b * perBar);
    const end = Math.min(length, Math.floor((b + 1) * perBar));
    let peak = 0;
    for (let i = start; i < end; i += stride) {
      let v = 0;
      for (const ch of channels) v += ch[i]!;
      v = Math.abs(v / channels.length);
      if (v > peak) peak = v;
    }
    peaks[b] = peak;
  }
  const max = peaks.reduce((a, v) => (v > a ? v : a), 0);
  if (max <= 0) return peaks;
  // Mild compression so quiet passages still read as a shape rather than a flat line.
  return peaks.map((v) => Math.pow(v / max, 0.7));
}
