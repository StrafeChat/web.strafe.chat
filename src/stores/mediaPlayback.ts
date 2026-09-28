import { createSignal } from 'solid-js';

/**
 * Cross-player state for the attachment media players: the remembered volume (so every
 * clip opens at the level the user last set, like a real media app) and "one thing plays
 * at a time" (starting a clip pauses whatever else was playing in the message list).
 */
const VOLUME_KEY = 'strafe_media_volume';

interface StoredVolume {
  volume: number;
  muted: boolean;
}

function loadVolume(): StoredVolume {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredVolume>;
      const volume = typeof parsed.volume === 'number' && Number.isFinite(parsed.volume) ? Math.min(1, Math.max(0, parsed.volume)) : 1;
      return { volume, muted: parsed.muted === true };
    }
  } catch {
    // ignore
  }
  return { volume: 1, muted: false };
}

const [preferredVolume, setPreferredVolumeSignal] = createSignal<StoredVolume>(loadVolume());
export { preferredVolume };

export function rememberVolume(volume: number, muted: boolean): void {
  const next = { volume: Math.min(1, Math.max(0, volume)), muted };
  setPreferredVolumeSignal(next);
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

let activeElement: HTMLMediaElement | null = null;

/** Called when a player starts: pauses any other player that was running. */
export function claimPlayback(el: HTMLMediaElement): void {
  if (activeElement && activeElement !== el && !activeElement.paused) {
    activeElement.pause();
  }
  activeElement = el;
}

export function releasePlayback(el: HTMLMediaElement): void {
  if (activeElement === el) activeElement = null;
}
