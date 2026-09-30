/**
 * Where the backends live. Resolved in order:
 *   1. window.__STRAFE_CONFIG__ - written into /config.js at container start
 *      (deploy/ docker image), so one build serves any domain;
 *   2. Vite env (VITE_API_URL / VITE_STARGATE_URL / VITE_CDN_URL) - local development;
 *   3. localhost defaults.
 */
export interface RuntimeConfig {
  apiUrl?: string;
  stargateUrl?: string;
  /** The instance's own object store / CDN (nebula). Serves avatars, emoji, attachments. */
  cdnUrl?: string;
  /** API key for the Giphy GIF picker (developers.giphy.com). Optional - the GIF tab shows a
   * "not configured" note without one. */
  giphyApiKey?: string;
  /** API key for the Heypster GIF picker (heypster.com; GIPHY-compatible API). Optional. */
  heypsterApiKey?: string;
}

declare global {
  interface Window {
    __STRAFE_CONFIG__?: RuntimeConfig;
  }
}

function runtime(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return window.__STRAFE_CONFIG__ ?? {};
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function apiUrl(): string {
  const fromRuntime = runtime().apiUrl;
  if (fromRuntime) return trimSlash(fromRuntime);
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return trimSlash(fromEnv || 'http://localhost:4000');
}

export function stargateUrl(): string {
  const fromRuntime = runtime().stargateUrl;
  if (fromRuntime) return trimSlash(fromRuntime);
  const fromEnv = import.meta.env.VITE_STARGATE_URL as string | undefined;
  if (fromEnv) return trimSlash(fromEnv);
  // Derive from the API URL when only that was configured. Behind Caddy both live on the
  // instance domain, so `<domain>/api` pairs with `<domain>/gateway/events` (https -> wss);
  // a bare dev API on :4000 pairs with a standalone gateway on :4001 (/events).
  const api = apiUrl();
  if (api.endsWith('/api')) {
    return api.slice(0, -'/api'.length).replace(/^http/, 'ws') + '/gateway/events';
  }
  if (api.endsWith(':4000')) return api.replace(/^http/, 'ws').replace(/:4000$/, ':4001') + '/events';
  return 'ws://localhost:4001/events';
}

/**
 * The instance's own CDN (nebula) - where avatars, custom emoji, attachments and the
 * bundled Unicode emoji sets are served from. Everything here stays on the instance's own
 * infrastructure; nothing an instance renders by default reaches a third-party host.
 *
 * Derived from the API URL when not set explicitly: behind Caddy the API is `<domain>/api`
 * and the CDN is `<domain>/cdn` (see deploy/Caddyfile); a bare dev API on :4000 pairs with
 * nebula on :4010.
 */
export function cdnUrl(): string {
  const fromRuntime = runtime().cdnUrl;
  if (fromRuntime) return trimSlash(fromRuntime);
  const fromEnv = import.meta.env.VITE_CDN_URL as string | undefined;
  if (fromEnv) return trimSlash(fromEnv);
  const api = apiUrl();
  if (api.endsWith('/api')) return api.slice(0, -'/api'.length) + '/cdn';
  if (api.endsWith(':4000')) return api.replace(/:4000$/, ':4010');
  return 'http://localhost:4010';
}

/** API key for a GIF provider, from runtime config or a VITE_ env fallback (dev). */
export function giphyApiKey(): string | undefined {
  return runtime().giphyApiKey || (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) || undefined;
}
export function heypsterApiKey(): string | undefined {
  return runtime().heypsterApiKey || (import.meta.env.VITE_HEYPSTER_API_KEY as string | undefined) || undefined;
}
