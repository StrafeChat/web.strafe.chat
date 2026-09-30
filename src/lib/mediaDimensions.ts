/**
 * A cache of media (image/video) natural dimensions, keyed by URL. Bare media links in
 * messages carry no width/height, so the first time one loads we record its intrinsic size;
 * every later render of it - re-entering the room, scrolling back through history, opening the
 * app tomorrow - can then reserve the right box up front and not shift the layout when the
 * bytes arrive. Kept in memory and mirrored to localStorage (bounded), because a size learned
 * once is true forever.
 */

const STORAGE_KEY = 'strafe.mediaDims.v1';
const PERSIST_MAX = 600;

type Dims = { width: number; height: number };

function loadPersisted(): Map<string, Dims> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, [number, number]>;
    const out = new Map<string, Dims>();
    for (const [url, v] of Object.entries(parsed)) {
      if (Array.isArray(v) && v[0] > 0 && v[1] > 0) out.set(url, { width: v[0], height: v[1] });
    }
    return out;
  } catch {
    return new Map();
  }
}

const cache = loadPersisted();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      // Map iteration is insertion-ordered: dropping from the front keeps the newest.
      const entries = [...cache.entries()].slice(-PERSIST_MAX).map(([url, d]) => [url, [d.width, d.height]] as const);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Storage unavailable: the in-memory cache still covers this session.
    }
  }, 500);
}

/** Remember a URL's natural size the first time we see it decoded. */
export function recordMediaDimensions(url: string | undefined, width: number, height: number): void {
  if (!url || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  if (cache.has(url)) return;
  cache.set(url, { width, height });
  schedulePersist();
}

/** The remembered natural size for a URL, if we've decoded it before. */
export function getMediaDimensions(url: string | undefined): Dims | undefined {
  return url ? cache.get(url) : undefined;
}

/**
 * Media links that failed to load (an expired upload, a dead host). A bare media link is
 * shown as the image or video first and only turns into a preview card once that fails - a
 * late reflow. Remembering the failure for a while lets every later render skip straight to
 * the card, in the same frame as the message.
 */
const FAILED_KEY = 'strafe.mediaFailed.v1';
const FAILED_TTL_MS = 10 * 60 * 1000;
const FAILED_MAX = 200;

function loadFailed(): Map<string, number> {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    if (!raw) return new Map();
    const now = Date.now();
    const out = new Map<string, number>();
    for (const [url, ts] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
      if (typeof ts === 'number' && now - ts < FAILED_TTL_MS) out.set(url, ts);
    }
    return out;
  } catch {
    return new Map();
  }
}

const failed = loadFailed();
let failedTimer: ReturnType<typeof setTimeout> | null = null;

export function recordMediaFailure(url: string | undefined): void {
  if (!url) return;
  failed.set(url, Date.now());
  if (failedTimer) return;
  failedTimer = setTimeout(() => {
    failedTimer = null;
    try {
      localStorage.setItem(FAILED_KEY, JSON.stringify(Object.fromEntries([...failed.entries()].slice(-FAILED_MAX))));
    } catch {
      // Storage unavailable: the in-memory record still covers this session.
    }
  }, 500);
}

/** True when this media URL failed to load within the last few minutes. */
export function hasRecentMediaFailure(url: string | undefined): boolean {
  if (!url) return false;
  const ts = failed.get(url);
  if (ts === undefined) return false;
  if (Date.now() - ts >= FAILED_TTL_MS) {
    failed.delete(url);
    return false;
  }
  return true;
}
