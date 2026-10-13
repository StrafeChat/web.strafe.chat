/**
 * Where to go once signed in: pages that need an account (an invite, the OAuth consent page)
 * send people to /login?redirect=<path>, and the sign-in and registration pages pass it along.
 *
 * Only a path on this same site is honoured, never an address elsewhere: the parameter is in
 * a link anyone can craft, and "sign in, then land on a look-alike page" is the classic open
 * redirect. The value is parsed the way the browser would parse it (a leading `//`, a
 * backslash, or a tab or newline the parser drops can all turn a "path" into another host),
 * and anything that does not stay on this origin falls back to home.
 */
export function safeRedirectPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith('/')) return '/';
  try {
    const here = window.location;
    const url = new URL(value, here.href);
    // Protocol and host rather than `origin`, which is "null" for the desktop app's own
    // tauri:// scheme and so would never match.
    if (url.protocol !== here.protocol || url.host !== here.host) return '/';
    const path = `${url.pathname}${url.search}${url.hash}`;
    // A path that a later parse could still read as another host (`//x`, or `/\x` on a
    // scheme where the parser above kept the backslash).
    return /^\/[/\\]/.test(path) ? '/' : path;
  } catch {
    return '/';
  }
}

/** `?redirect=<path>` to carry a sign-in target on to the next auth page, or '' for home. */
export function redirectQuery(path: string): string {
  return path === '/' ? '' : `redirect=${encodeURIComponent(path)}`;
}
