/**
 * Which instance the desktop app is talking to right now.
 *
 * The web client gets its API, gateway and CDN addresses from config.js, written once per
 * deployment: a page served by an instance only ever talks to that instance. The desktop
 * app is one build for every instance, so the addresses come from the account in use
 * instead, and `runtimeConfig` reads them from here first. Kept in localStorage (not the
 * account file on the Rust side) because the API client needs it synchronously, at module
 * load, before any command could answer.
 *
 * No imports: this file is read by runtimeConfig, which nearly everything imports.
 */

export interface DesktopInstance {
  /** The instance's own name for itself (its federation domain), or the host it was
   * reached at when it does not federate. What the account switcher shows. */
  domain: string;
  apiUrl: string;
  stargateUrl: string;
  /** Left unset to derive from apiUrl, as runtimeConfig does for the web client. */
  cdnUrl?: string;
}

const KEY = 'strafe.desktop.instance';

let cache: DesktopInstance | null | undefined;

function isDesktopInstance(v: unknown): v is DesktopInstance {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.domain === 'string' && typeof o.apiUrl === 'string' && typeof o.stargateUrl === 'string';
}

export function getDesktopInstance(): DesktopInstance | null {
  if (cache !== undefined) return cache;
  cache = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isDesktopInstance(parsed)) cache = parsed;
    }
  } catch {
    /* no storage, or an unreadable value: no instance */
  }
  return cache;
}

export function setDesktopInstance(instance: DesktopInstance | null): void {
  cache = instance;
  try {
    if (instance) window.localStorage.setItem(KEY, JSON.stringify(instance));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
