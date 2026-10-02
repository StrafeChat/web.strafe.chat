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
 * Detect Strafe space invite URLs (same shape as `/invite/:code` in the app router).
 */
export function extractSpaceInviteCodeFromUrl(href: string): string | null {
  const trimmed = href.trim();
  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.invalid';
    const u = new URL(trimmed, base);
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
