import { apiUrl, publicWebOrigin } from '../runtimeConfig';

/**
 * The web origin of another Strafe instance as a person types it on the invite page:
 * a bare domain (`chat.example.com`, optionally with a port) becomes https, a full
 * http(s) URL keeps its scheme and host. Anything else is null. The result is where
 * `/invite/<code>@<origin>` is opened so they can join from their own account.
 */
export function instanceBaseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (!u.host) return null;
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(s)) return null;
  return `https://${s.toLowerCase()}`;
}

/**
 * Whether a link points at this instance: the page's own host, the host of its API, or the
 * host its shareable links are built on. The last two are what match in the desktop app, which
 * runs from its own origin while people paste the instance's https links. Behind the standard
 * reverse proxy the API is served from the instance's own domain, but where it lives on a host
 * of its own, only the web origin the app recorded for the instance (the one its own "copy
 * invite" uses) recognises a link copied from it.
 */
function isThisInstanceHost(host: string): boolean {
  if (typeof window !== 'undefined' && host === window.location.host) return true;
  return host === hostOf(apiUrl()) || host === hostOf(publicWebOrigin());
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/**
 * Detect Strafe space invite URLs (same shape as `/invite/:code` in the app router) that
 * belong to this instance.
 *
 * Only this instance's links count. Matching on the path alone treated every site's
 * `/invite/<code>` as ours - discord.com/invite/abc, or another Strafe instance's link -
 * looked the code up here, and showed "invalid invite" (or, on a colliding code, a join card
 * for an unrelated local space) under it, with the normal link preview suppressed. A link
 * from anywhere else is left as an ordinary link. It is not resolved as `code@thatHost`
 * either: that would have this server contact whatever domain a message names, including
 * from an encrypted room.
 */
export function extractSpaceInviteCodeFromUrl(href: string): string | null {
  const trimmed = href.trim();
  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.invalid';
    const u = new URL(trimmed, base);
    if (!isThisInstanceHost(u.host)) return null;
    // A code alone, or code@instance for a space hosted on another instance (the "@"
    // may arrive percent-encoded).
    const m = u.pathname.match(/^\/invite\/([a-zA-Z0-9]+(?:(?:@|%40)[a-zA-Z0-9.-]+(?:(?::|%3A)\d+)?)?)\/?$/i);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
