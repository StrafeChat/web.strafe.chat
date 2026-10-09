/**
 * Is this the desktop app? The Tauri shell injects `__TAURI_INTERNALS__` before any page
 * script runs, so the answer is known synchronously and never changes for the page's
 * lifetime. Everything desktop-specific gates on this: in a browser it is simply false
 * and the app is the web client it always was.
 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export type DesktopPlatform = 'mac' | 'windows' | 'linux';

/** Which desktop OS the shell runs on - from the user agent, which every webview sets. */
export function desktopPlatform(): DesktopPlatform {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  return 'linux';
}
