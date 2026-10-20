import { api } from './client';
import type { GifProviderId } from '../lib/gif/providers';

/**
 * GIF search and trending, proxied by the instance (GET /gifs/search, /gifs/trending). The
 * provider's API key stays on the server - it used to sit in config.js, readable by anyone -
 * and GIPHY / Heypster see the instance asking, not each person's address and search terms.
 * The server normalizes the provider's rendition set to this shape.
 */
export interface WireGif {
  id: string;
  title: string;
  url: string;
  width: number;
  height: number;
  preview_url: string;
  preview_width: number;
  preview_height: number;
  still_url?: string;
}

export interface WireGifPage {
  results: WireGif[];
  next_offset: number;
  total_count: number;
}

export function searchGifs(provider: GifProviderId, q: string, limit: number, offset: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ provider, q, limit: String(limit), offset: String(offset) });
  return api<WireGifPage>(`/gifs/search?${params.toString()}`, { signal });
}

export function trendingGifs(provider: GifProviderId, limit: number, offset: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ provider, limit: String(limit), offset: String(offset) });
  return api<WireGifPage>(`/gifs/trending?${params.toString()}`, { signal });
}
