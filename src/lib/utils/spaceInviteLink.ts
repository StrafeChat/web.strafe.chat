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
    const m = u.pathname.match(/^\/invite\/([a-zA-Z0-9]+(?:(?:@|%40)[a-zA-Z0-9.\-]+(?:(?::|%3A)\d+)?)?)\/?$/i);
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
