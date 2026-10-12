/**
 * The contract between the web client and the Linux desktop shell (Electron, in
 * StrafeChat/desktop `electron/`). The shell's preload script exposes exactly this object as
 * `window.strafeDesktop`; the Tauri shell (Windows, macOS) is reached through
 * `@tauri-apps/api` instead, and `native.ts` hides which one is underneath.
 *
 * Why two shells: Linux webviews (WebKitGTK) have no WebRTC engine fit for encrypted calls,
 * so the Linux app runs the same client on Chromium. See desktop/docs/linux-voice.md.
 *
 * Changing this interface means changing `electron/preload.js` in the desktop repository in
 * the same release: bump `version` when a member's meaning changes.
 */

import type { DesktopPrefs, DiscordPresence } from './native';

export interface ScreenSource {
  /** Opaque id to hand back to `screen.choose`. */
  id: string;
  name: string;
  kind: 'screen' | 'window';
  /** A small preview as a data: URL (may be empty when the system gave none). */
  thumbnail: string;
  /** The window's application icon as a data: URL, when there is one. */
  appIcon?: string;
}

export interface UpdateInfo {
  version: string;
  notes: string;
}

export interface ElectronDesktopBridge {
  readonly kind: 'electron';
  /** Bumped when a member below changes meaning. */
  readonly version: 1;
  readonly platform: 'linux' | 'windows' | 'mac';
  /** The installed app's version (what Settings -> Desktop shows). */
  readonly appVersion: string;
  /** True in a popup window (the OAuth consent page), false in the main window. */
  readonly isPopup: boolean;

  /** The page has painted: show the window, unless this was a `--minimized` login launch. */
  ready(): void;
  /** Bring the main window forward (from a notification, say). */
  show(): void;

  window: {
    minimize(): void;
    toggleMaximize(): void;
    /** Main window: quit or hide to the tray, as Settings say. Popup: close it. */
    close(): void;
    isMaximized(): Promise<boolean>;
    isFocused(): Promise<boolean>;
    /** Calls back with the maximised state whenever it changes; returns the unsubscribe. */
    onMaximizeChange(cb: (maximized: boolean) => void): () => void;
    /** Flash the taskbar entry when the window is not focused. */
    requestAttention(): void;
    /** Open an in-app page (a path such as `/oauth2/authorize?...`) in its own window. */
    openPopup(path: string, opts: { width?: number; height?: number; title?: string }): void;
  };

  /** http(s) and mailto links open in the system browser / mail client; anything else is refused. */
  openExternal(url: string): Promise<void>;
  /** Unread mentions on the launcher icon (where the desktop supports a count). */
  setBadgeCount(count: number): void;
  /** A native notification; clicking it brings the main window forward. */
  notify(title: string, body?: string): void;

  /** The accounts file (accounts.json, owner-only), as the client stored it; null when none. */
  accounts: { load(): Promise<unknown>; save(value: unknown): Promise<void> };
  /** prefs.json - the same file and shape the Tauri shell keeps. */
  prefs: { load(): Promise<DesktopPrefs>; save(prefs: DesktopPrefs): Promise<void> };
  /** Start at login (an XDG autostart entry launching with `--minimized`). */
  autostart: { isEnabled(): Promise<boolean>; enable(): Promise<void>; disable(): Promise<void> };
  discord: {
    /** What Discord shows under "Playing Strafe"; the shell decides whether to show it at all. */
    set(presence: DiscordPresence): void;
    /** False when this build carries no Discord application ID. */
    available(): Promise<boolean>;
  };

  /** Delete the app origin's IndexedDB and relaunch. Never resolves on success. */
  wipeStorageAndRestart(): Promise<void>;

  updater: {
    /** Null when up to date; rejects (with a readable message) when it cannot check. */
    check(): Promise<UpdateInfo | null>;
    /** Download and verify the update `check` found, reporting 0-100. */
    download(onProgress: (percent: number) => void): Promise<void>;
    /** Install what `download` fetched and relaunch. May show the system's password prompt
     * (deb/rpm installs go through pkexec). Rejects if installing failed. */
    install(): Promise<void>;
  };

  screen: {
    /** What can be shared, for the app's own picker - or null when the system shows its own
     * picker (Wayland: the desktop portal), in which case just call getDisplayMedia. */
    sources(): Promise<ScreenSource[] | null>;
    /** The source the next getDisplayMedia call shares. */
    choose(id: string): Promise<void>;
  };
}

declare global {
  interface Window {
    strafeDesktop?: ElectronDesktopBridge;
  }
}

/** The Electron shell's bridge, or null under Tauri or in a browser. */
export function electronBridge(): ElectronDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const b = window.strafeDesktop;
  return b && b.kind === 'electron' ? b : null;
}
