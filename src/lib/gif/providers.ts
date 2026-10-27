/**
 * GIF search providers for the composer's GIF picker.
 *
 * The user picks one of two providers in Appearance settings: GIPHY (giphy.com) or Heypster
 * (heypster.com). Neither is called from the browser: the instance proxies both through
 * GET /gifs/search and /gifs/trending (src/api/gifs.ts), so the provider's API key stays on
 * the server and the provider never sees a user's address or what they searched for. The
 * operator sets the keys on the API service (GIPHY_API_KEY / HEYPSTER_API_KEY); the instance
 * lists the providers it has a key for on GET / (`features.gifs.providers`), and the GIF tab
 * shows a "not configured" note until there is one.
 */

import { ApiError } from '../../api/ApiError';
import { searchGifs, trendingGifs, type WireGif, type WireGifPage } from '../../api/gifs';
import { instance } from '../../stores/instance';

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

/** Whether this instance has a key for the given provider and can be queried. */
export function gifProviderConfigured(id: GifProviderId): boolean {
  return instance.gifProviders.includes(id);
}

/** A single GIF, normalized (by the instance) from the provider's rendition set. */
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

/** Thrown when the instance has no API key for a provider, so the UI can show a distinct message. */
export class GifNotConfiguredError extends Error {
  constructor(public providerId: GifProviderId) {
    super(`GIF provider ${providerId} is not configured`);
    this.name = 'GifNotConfiguredError';
  }
}

export interface FetchGifsOptions {
  /** Empty/undefined => trending. */
  query?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// The server already picked the renditions and dropped anything unusable; this only guards
// against a malformed item reaching an <img src> or being sent as a message.
function fromWire(g: WireGif): GifResult | null {
  if (!g || typeof g.url !== 'string' || !g.url || typeof g.preview_url !== 'string' || !g.preview_url) return null;
  return {
    id: typeof g.id === 'string' && g.id ? g.id : g.url,
    title: typeof g.title === 'string' ? g.title : '',
    url: g.url,
    width: num(g.width),
    height: num(g.height),
    previewUrl: g.preview_url,
    previewWidth: num(g.preview_width),
    previewHeight: num(g.preview_height),
    stillUrl: typeof g.still_url === 'string' && g.still_url ? g.still_url : undefined,
  };
}

/** Fetch a page of GIFs (trending when no query) from the given provider, through the instance. */
export async function fetchGifs(id: GifProviderId, opts: FetchGifsOptions = {}): Promise<GifPage> {
  const { query, limit = 24, offset = 0, signal } = opts;
  const q = query?.trim();
  let page: WireGifPage | undefined;
  try {
    page = q ? await searchGifs(id, q, limit, offset, signal) : await trendingGifs(id, limit, offset, signal);
  } catch (e) {
    // The instance has no key for this provider (it may have been removed since GET / was read).
    if (e instanceof ApiError && e.status === 404 && e.code === 'gif_not_configured') throw new GifNotConfiguredError(id);
    throw e;
  }
  const results = (Array.isArray(page?.results) ? page.results : []).map(fromWire).filter((r): r is GifResult => r !== null);
  const nextOffset = typeof page?.next_offset === 'number' ? page.next_offset : offset + results.length;
  const totalCount = typeof page?.total_count === 'number' ? page.total_count : nextOffset;
  return { results, nextOffset, totalCount };
}

// Direct-GIF URL detection, used by the message renderer to embed a bare GIF link inline.
const GIF_HOSTS = ['giphy.com', 'media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com', 'heypster.com', 'heypster-gif.com', 'media.heypster-gif.com', 'tenor.com', 'media.tenor.com', 'c.tenor.com'];

/** A message link that should render as inline media rather than an unfurl card. */
export type MediaKind = 'gif' | 'image' | 'video';

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|bmp)$/;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/;

/** Classify a URL as directly-embeddable media, or null for a normal link. A .gif anywhere (or
 * a .webp/.mp4 on a known GIF host) is a GIF; other image/video extensions are image/video. */
export function mediaKind(href: string): MediaKind | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const path = u.pathname.toLowerCase();
  const host = u.hostname.toLowerCase();
  const gifHost = GIF_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (path.endsWith('.gif')) return 'gif';
  if (gifHost && (path.endsWith('.webp') || path.endsWith('.mp4'))) return 'gif';
  if (IMAGE_EXT.test(path)) return 'image';
  if (VIDEO_EXT.test(path)) return 'video';
  return null;
}

/** True for a URL that should render as an inline animated GIF. */
export function isGifUrl(href: string): boolean {
  return mediaKind(href) === 'gif';
}
