import { electronBridge } from './electronBridge';

export type DesktopShell = 'tauri' | 'electron';

/**
 * Which desktop shell the page runs in: Tauri on Windows and macOS, Electron on Linux (where
 * WebKitGTK cannot carry an encrypted call - see electronBridge.ts), or null in a browser.
 * Both shells announce themselves before any page script runs - Tauri injects
 * `__TAURI_INTERNALS__`, Electron's preload exposes `window.strafeDesktop` - so the answer is
 * known synchronously and never changes for the page's lifetime.
 */
export function desktopShell(): DesktopShell | null {
  if (typeof window === 'undefined') return null;
  if (electronBridge()) return 'electron';
  if ('__TAURI_INTERNALS__' in window) return 'tauri';
  return null;
}

/**
 * Is this the desktop app, in either shell? Everything desktop-specific gates on this: in a
 * browser it is simply false and the app is the web client it always was.
 */
export function isDesktop(): boolean {
  return desktopShell() !== null;
}

export type DesktopPlatform = 'mac' | 'windows' | 'linux';

/**
 * Which desktop OS the shell runs on. The Electron shell says so itself; under Tauri it comes
 * from the user agent, which every webview sets.
 */
export function desktopPlatform(): DesktopPlatform {
  const bridge = electronBridge();
  if (bridge) return bridge.platform;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac';
  if (/Windows/i.test(ua)) return 'windows';
  return 'linux';
}
