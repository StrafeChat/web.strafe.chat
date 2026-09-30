/**
 * Client-side cache for link-preview metadata. Each unique URL is unfurled once (the server
 * caches too) and the result kept, so re-rendering a message list doesn't re-request and the
 * same link in several messages shares one fetch. A preview with no title, description or
 * image is treated as "nothing to show" (status 'empty') so the card is hidden.
 *
 * Two things keep preview cards from popping in and shoving the conversation around:
 *  - results are persisted in localStorage (bounded, a day's TTL), so a link seen before
 *    renders its card in the same frame as the message on every later visit or reload;
 *  - `warmLinkPreviews` lets the history loader fetch a page's previews *before* the
 *    messages are shown, so a fresh room appears with its cards already in place instead of
 *    one card at a time. (Discord gets the same effect by unfurling on the server and
 *    shipping embeds with the message; here the server can't read encrypted rooms, so the
 *    client does the waiting.)
 */

import { createStore } from 'solid-js/store';
import { fetchUnfurl, type LinkMetadata } from '../api/unfurl';

export type LinkPreviewStatus = 'loading' | 'ok' | 'empty' | 'error';

export interface LinkPreviewEntry {
  status: LinkPreviewStatus;
  data?: LinkMetadata;
}

interface LinkPreviewState {
  byUrl: Record<string, LinkPreviewEntry>;
}

const STORAGE_KEY = 'strafe.linkPreviews.v1';
const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed unfurl is remembered briefly too, so a dead link isn't re-tried (and doesn't hold
 * the history loader up) on every visit within a few minutes. */
const PERSIST_ERROR_TTL_MS = 10 * 60 * 1000;
const PERSIST_MAX = 300;

interface PersistedEntry {
  status: 'ok' | 'empty' | 'error';
  data?: LinkMetadata;
  ts: number;
}

function loadPersisted(): Record<string, PersistedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PersistedEntry>;
    const now = Date.now();
    const out: Record<string, PersistedEntry> = {};
    for (const [url, e] of Object.entries(parsed)) {
      if (!e || typeof e.ts !== 'number') continue;
      const ttl = e.status === 'error' ? PERSIST_ERROR_TTL_MS : PERSIST_TTL_MS;
      if ((e.status === 'ok' || e.status === 'empty' || e.status === 'error') && now - e.ts < ttl) out[url] = e;
    }
    return out;
  } catch {
    return {};
  }
}

const persisted = loadPersisted();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Write the persisted map back, newest entries kept, a little after the last change. */
function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const entries = Object.entries(persisted).sort((a, b) => b[1].ts - a[1].ts).slice(0, PERSIST_MAX);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Storage full or unavailable: the in-memory cache still works for this session.
    }
  }, 400);
}

const initial: Record<string, LinkPreviewEntry> = {};
for (const [url, e] of Object.entries(persisted)) initial[url] = { status: e.status, data: e.data };

const [linkPreviews, setLinkPreviews] = createStore<LinkPreviewState>({ byUrl: initial });

export { linkPreviews };

function hasContent(m: LinkMetadata): boolean {
  return !!(m.title || m.description || m.image || m.video);
}

const inFlight = new Map<string, Promise<void>>();

/**
 * Fetch (once) the preview for a URL; components read linkPreviews.byUrl[url] reactively.
 * Resolves when the entry has settled (already cached, fetched, or failed).
 */
export function ensureLinkPreview(url: string): Promise<void> {
  const existing = linkPreviews.byUrl[url];
  if (existing && existing.status !== 'loading') return Promise.resolve();
  const pending = inFlight.get(url);
  if (pending) return pending;
  setLinkPreviews('byUrl', url, { status: 'loading' });
  const p = fetchUnfurl(url)
    .then((data) => {
      const status = hasContent(data) ? 'ok' : 'empty';
      setLinkPreviews('byUrl', url, { status, data });
      persisted[url] = { status, data: status === 'ok' ? data : undefined, ts: Date.now() };
      schedulePersist();
    })
    .catch(() => {
      setLinkPreviews('byUrl', url, { status: 'error' });
      persisted[url] = { status: 'error', ts: Date.now() };
      schedulePersist();
    })
    .finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

/**
 * Start fetching every URL and wait for them - up to `timeoutMs`, so one slow site never
 * holds a whole page of history back. Whatever hasn't answered by then still lands in the
 * cache when it does and its card appears late, as before.
 */
export function warmLinkPreviews(urls: Iterable<string>, timeoutMs: number): Promise<void> {
  const pending: Promise<void>[] = [];
  for (const url of urls) {
    const e = linkPreviews.byUrl[url];
    if (e && e.status !== 'loading') continue;
    pending.push(ensureLinkPreview(url));
  }
  if (pending.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.allSettled(pending).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
