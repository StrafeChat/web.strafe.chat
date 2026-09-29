/**
 * A session cache of media (image/video) natural dimensions, keyed by URL. Bare media links in
 * messages carry no width/height, so the first time one loads we record its intrinsic size; every
 * later render of it - re-entering the room, scrolling back through history - can then reserve the
 * right box up front and not shift the layout when the bytes arrive.
 */

const cache = new Map<string, { width: number; height: number }>();

/** Remember a URL's natural size the first time we see it decoded. */
export function recordMediaDimensions(url: string | undefined, width: number, height: number): void {
  if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  if (!cache.has(url)) cache.set(url, { width, height });
}

/** The remembered natural size for a URL, if we've decoded it before this session. */
export function getMediaDimensions(url: string | undefined): { width: number; height: number } | undefined {
  return url ? cache.get(url) : undefined;
}
