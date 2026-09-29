/**
 * GIF search providers for the composer's GIF picker.
 *
 * The user picks one of two providers in Appearance settings: GIPHY (giphy.com) or Heypster
 * (heypster.com). Heypster exposes a GIPHY-compatible REST API, so both speak the same
 * request/response shape and share one parser here - the only difference is the base URL and
 * which API key (from runtime config) is sent. No key is bundled: the instance operator sets
 * `giphyApiKey` / `heypsterApiKey` in config.js (or VITE_GIPHY_API_KEY / VITE_HEYPSTER_API_KEY
 * for local dev), and the GIF tab shows a "not configured" note until one is present.
 */

import { giphyApiKey, heypsterApiKey } from '../runtimeConfig';

export type GifProviderId = 'giphy' | 'heypster';

export interface GifProviderInfo {
  id: GifProviderId;
  name: string;
  homepage: string;
  /** Shown as the required attribution strip at the bottom of the picker. */
  attribution: string;
}

export const GIF_PROVIDERS: GifProviderInfo[] = [
  { id: 'giphy', name: 'GIPHY', homepage: 'https://giphy.com/', attribution: 'Powered by GIPHY' },
  { id: 'heypster', name: 'Heypster', homepage: 'https://heypster.com/', attribution: 'Powered by Heypster' },
];

export const DEFAULT_GIF_PROVIDER: GifProviderId = 'giphy';

export function isGifProviderId(v: unknown): v is GifProviderId {
  return v === 'giphy' || v === 'heypster';
}

export function gifProviderInfo(id: GifProviderId): GifProviderInfo {
  return GIF_PROVIDERS.find((p) => p.id === id) ?? GIF_PROVIDERS[0]!;
}

const BASE_URL: Record<GifProviderId, string> = {
  giphy: 'https://api.giphy.com/v1',
  heypster: 'https://heypster-gif.com/giphy/v1',
};

function apiKeyFor(id: GifProviderId): string | undefined {
  return id === 'giphy' ? giphyApiKey() : heypsterApiKey();
}

/** Whether the given provider has an API key configured and can be queried. */
export function gifProviderConfigured(id: GifProviderId): boolean {
  return !!apiKeyFor(id);
}

/** A single GIF, normalized from the provider's rendition set. */
export interface GifResult {
  id: string;
  title: string;
  /** Direct .gif URL - what gets sent as the message and rendered inline. */
  url: string;
  width: number;
  height: number;
  /** Smaller animated rendition shown in the picker grid. */
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  /** Still frame, used as a lightweight placeholder while the animation loads. */
  stillUrl?: string;
}

export interface GifPage {
  results: GifResult[];
  /** Offset to pass for the next page (for infinite scroll). */
  nextOffset: number;
  /** Total results the provider reports, so paging can stop. */
  totalCount: number;
}

/** Thrown when a provider has no API key configured, so the UI can show a distinct message. */
export class GifNotConfiguredError extends Error {
  constructor(public providerId: GifProviderId) {
    super(`GIF provider ${providerId} is not configured`);
    this.name = 'GifNotConfiguredError';
  }
}

interface RawRendition {
  url?: string;
  width?: string | number;
  height?: string | number;
}

function num(v: string | number | undefined): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return Number.isFinite(n) ? (n as number) : 0;
}

/** First rendition (in preference order) that carries a usable url. */
function pickRendition(images: Record<string, RawRendition> | undefined, keys: string[]): RawRendition | undefined {
  if (!images) return undefined;
  for (const k of keys) {
    const r = images[k];
    if (r && typeof r.url === 'string' && r.url) return r;
  }
  return undefined;
}

// Grid preview: ~200px animated, small file. Sent URL: a downsized .gif (falls back to
// original). Still: a single frame for the placeholder.
const PREVIEW_KEYS = ['fixed_width', 'fixed_width_downsampled', 'fixed_height', 'downsized', 'preview_gif', 'original'];
const FULL_KEYS = ['downsized', 'downsized_medium', 'downsized_large', 'original', 'fixed_width'];
const STILL_KEYS = ['fixed_width_still', 'fixed_height_still', '480w_still', 'original_still'];

function toResult(item: unknown): GifResult | null {
  if (!item || typeof item !== 'object') return null;
  const d = item as { id?: unknown; title?: unknown; images?: Record<string, RawRendition> };
  const preview = pickRendition(d.images, PREVIEW_KEYS);
  const full = pickRendition(d.images, FULL_KEYS) ?? preview;
  if (!preview?.url || !full?.url) return null;
  const still = pickRendition(d.images, STILL_KEYS);
  return {
    id: String(d.id ?? full.url),
    title: typeof d.title === 'string' ? d.title : '',
    url: full.url,
    width: num(full.width),
    height: num(full.height),
    previewUrl: preview.url,
    previewWidth: num(preview.width),
    previewHeight: num(preview.height),
    stillUrl: still?.url,
  };
}

export interface FetchGifsOptions {
  /** Empty/undefined => trending. */
  query?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

/** Fetch a page of GIFs (trending when no query) from the given provider. */
export async function fetchGifs(id: GifProviderId, opts: FetchGifsOptions = {}): Promise<GifPage> {
  const key = apiKeyFor(id);
  if (!key) throw new GifNotConfiguredError(id);
  const { query, limit = 24, offset = 0, signal } = opts;
  const q = query?.trim();
  const params = new URLSearchParams({
    api_key: key,
    limit: String(limit),
    offset: String(offset),
    rating: 'pg-13',
  });
  if (q) params.set('q', q);
  const path = q ? '/gifs/search' : '/gifs/trending';
  const res = await fetch(`${BASE_URL[id]}${path}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`GIF search failed (${res.status})`);
  const json = (await res.json()) as { data?: unknown[]; pagination?: { offset?: number; count?: number; total_count?: number } };
  const results = (json.data ?? []).map(toResult).filter((r): r is GifResult => r !== null);
  const pag = json.pagination ?? {};
  const nextOffset = (typeof pag.offset === 'number' ? pag.offset : offset) + (typeof pag.count === 'number' ? pag.count : results.length);
  const totalCount = typeof pag.total_count === 'number' ? pag.total_count : nextOffset + results.length;
  return { results, nextOffset, totalCount };
}

// Direct-GIF URL detection, used by the message renderer to embed a bare GIF link inline.
const GIF_HOSTS = ['giphy.com', 'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com', 'heypster.com', 'heypster-gif.com', 'media.heypster-gif.com', 'tenor.com', 'media.tenor.com', 'c.tenor.com'];

/** True for a URL that should render as an inline animated GIF (a .gif anywhere, or a
 * .webp/.mp4 on a known GIF host). */
export function isGifUrl(href: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const path = u.pathname.toLowerCase();
  if (path.endsWith('.gif')) return true;
  const host = u.hostname.toLowerCase();
  const known = GIF_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return known && (path.endsWith('.webp') || path.endsWith('.mp4'));
}
