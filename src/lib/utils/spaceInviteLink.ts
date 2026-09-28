/**
 * Detect Strafe space invite URLs (same shape as `/invite/:code` in the app router).
 */
export function extractSpaceInviteCodeFromUrl(href: string): string | null {
  const trimmed = href.trim();
  try {
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.invalid';
    const u = new URL(trimmed, base);
    const m = u.pathname.match(/^\/invite\/([a-zA-Z0-9]+)\/?$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
