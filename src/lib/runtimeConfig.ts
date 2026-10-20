/**
 * Where the backends live. Resolved in order:
 *   1. window.__STRAFE_CONFIG__ - written into /config.js at container start
 *      (deploy/ docker image), so one build serves any domain;
 *   2. Vite env (VITE_API_URL / VITE_STARGATE_URL / VITE_CDN_URL) - local development;
 *   3. localhost defaults.
 */
import { isDesktop } from '../desktop/env';
import { getDesktopInstance } from '../desktop/instanceOverride';

export interface RuntimeConfig {
  apiUrl?: string;
  stargateUrl?: string;
  /** The instance's own object store / CDN (nebula). Serves avatars, emoji, attachments. */
  cdnUrl?: string;
  // No GIF API keys: config.js is public, so a key here was anyone's to take. The API holds
  // them and proxies GIF search (GET /gifs/*); an older config.js that still carries
  // giphyApiKey / heypsterApiKey is simply never read.
}

declare global {
  interface Window {
    __STRAFE_CONFIG__?: RuntimeConfig;
  }
}

function runtime(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  const deployed = window.__STRAFE_CONFIG__ ?? {};
  // The desktop app is one build for every instance: the account in use decides where the
  // backends are, and that wins over anything baked into the build.
  if (isDesktop()) {
    const inst = getDesktopInstance();
    if (inst) {
      return {
        ...deployed,
        apiUrl: inst.apiUrl,
        stargateUrl: inst.stargateUrl,
        ...(inst.cdnUrl ? { cdnUrl: inst.cdnUrl } : {}),
      };
    }
  }
  return deployed;
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
  return deriveStargateUrl(apiUrl());
}

/**
 * The gateway that goes with an API URL, when only that was configured. Behind Caddy both
 * live on the instance domain, so `<domain>/api` pairs with `<domain>/gateway/events`
 * (https -> wss); a bare dev API on :4000 pairs with a standalone gateway on :4001
 * (/events). Also what the desktop app uses for an instance that only named its API.
 */
export function deriveStargateUrl(api: string): string {
  api = trimSlash(api);
  if (api.endsWith('/api')) {
    return api.slice(0, -'/api'.length).replace(/^http/, 'ws') + '/gateway/events';
  }
  // A bare API on a port is a development instance, and its gateway sits on the next port
  // (4000/4001, 4100/4101, 4200/4201 - every dev config in the repo follows it).
  const m = api.match(/^(https?):\/\/([^/]+):(\d+)$/);
  if (m) return `${m[1] === 'https' ? 'wss' : 'ws'}://${m[2]}:${Number(m[3]) + 1}/events`;
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

/**
 * Where an instance's web client lives, given its API. In the standard deployment one host
 * serves both (`<domain>/api` beside the client at `<domain>/`, see deploy/Caddyfile), so an
 * API ending in /api names the client's origin; any other layout gets `fallback`.
 */
export function webOriginForApi(api: string, fallback: string): string {
  api = trimSlash(api);
  if (api.endsWith('/api')) {
    try {
      return new URL(api).origin;
    } catch {
      /* not a URL: the fallback */
    }
  }
  return trimSlash(fallback);
}

/**
 * The origin for links meant to leave the app - invites, room links, bot install links, the
 * developer docs - so they open for whoever receives them. In a browser that is the page's
 * own origin, the instance that served it. The desktop app's page is tauri://localhost (or
 * http://tauri.localhost), which opens nothing anywhere else, so there it is the web client
 * of the instance in use. Navigation inside the app keeps `window.location.origin`.
 */
export function publicWebOrigin(): string {
  if (typeof window === 'undefined') return '';
  if (isDesktop()) {
    const inst = getDesktopInstance();
    if (inst) {
      if (typeof inst.webOrigin === 'string' && /^https?:\/\//i.test(inst.webOrigin)) return trimSlash(inst.webOrigin);
      // Saved before the instance's web origin was recorded.
      return webOriginForApi(inst.apiUrl, `https://${inst.domain}`);
    }
  }
  return window.location.origin;
}

