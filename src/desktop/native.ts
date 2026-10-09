/**
 * The native shell, as the web client needs it: window chrome, the system browser,
 * notifications, the taskbar badge, start-up preferences. Every function here assumes it
 * runs inside the desktop app (callers gate on isDesktop()).
 */

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { disable as autostartDisable, enable as autostartEnable, isEnabled as autostartIsEnabled } from '@tauri-apps/plugin-autostart';
import { desktopPlatform } from './env';

// ---- window --------------------------------------------------------------------------------

export const desktopWindow = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  /** The shell decides what close means (quit, or hide to the tray - Settings -> Desktop). */
  close: () => getCurrentWindow().close(),
  isMaximized: () => getCurrentWindow().isMaximized(),
  /** Calls back with the maximised state whenever the window is resized. */
  onMaximizeChange(cb: (maximized: boolean) => void): Promise<() => void> {
    const w = getCurrentWindow();
    return w.onResized(() => {
      void w.isMaximized().then(cb);
    });
  },
  isPopup: () => getCurrentWindow().label.startsWith('popup-'),
};

/** The page has painted: the shell may show the window (it starts hidden). */
export function markDesktopReady(): Promise<void> {
  return invoke('desktop_ready');
}

// ---- links and windows -----------------------------------------------------------------------

/** A link to somewhere else opens in the system browser, as it should in an app. */
export function openExternalUrl(url: string): Promise<void> {
  return openUrl(url);
}

/**
 * An in-app page in its own small window (the OAuth consent screen a bot install opens).
 * A browser would open a tab; a desktop app opens a window.
 */
export function openPopupWindow(url: string, opts: { width?: number; height?: number; title?: string } = {}): void {
  const label = `popup-${Date.now().toString(36)}`;
  new WebviewWindow(label, {
    url,
    title: opts.title ?? 'Strafe',
    width: opts.width ?? 540,
    height: opts.height ?? 760,
    center: true,
    resizable: true,
    decorations: true,
  });
}

export function closeCurrentWindow(): Promise<void> {
  return getCurrentWindow().close();
}

// ---- notifications --------------------------------------------------------------------------

let granted: boolean | null = null;

/** Cached answer of the last permission check; null until one has run. */
export function nativeNotificationsGrantedSync(): boolean | null {
  return granted;
}

export async function nativeNotificationsGranted(): Promise<boolean> {
  try {
    granted = await isPermissionGranted();
  } catch {
    granted = false;
  }
  return granted;
}

export async function requestNativeNotifications(): Promise<boolean> {
  if (await nativeNotificationsGranted()) return true;
  try {
    granted = (await requestPermission()) === 'granted';
  } catch {
    granted = false;
  }
  return granted;
}

export function sendNativeNotification(title: string, body?: string): void {
  sendNotification({ title, body });
}

/** Ask for attention (taskbar flash, dock bounce) when the window is not in front. */
export async function flashWindow(): Promise<void> {
  const w = getCurrentWindow();
  if (await w.isFocused()) return;
  await w.requestUserAttention(UserAttentionType.Informational);
}

// ---- badge ------------------------------------------------------------------------------------

let overlayIcon: Uint8Array | null = null;

/**
 * Unread mentions on the app icon: a count in the dock (macOS) or launcher (Linux), and
 * a red overlay dot on the taskbar icon on Windows, which has no count.
 */
export async function setUnreadBadge(count: number): Promise<void> {
  const w = getCurrentWindow();
  if (desktopPlatform() === 'windows') {
    if (count <= 0) {
      await w.setOverlayIcon(undefined);
      return;
    }
    if (!overlayIcon) {
      const res = await fetch('/icons/badge-overlay.png');
      overlayIcon = new Uint8Array(await res.arrayBuffer());
    }
    await w.setOverlayIcon(overlayIcon);
    return;
  }
  await w.setBadgeCount(count > 0 ? count : undefined);
}

// ---- preferences -------------------------------------------------------------------------------

export interface DesktopPrefs {
  closeToTray: boolean;
  startMinimized: boolean;
  /** "Playing Strafe" on the person's Discord profile while the window is open. */
  discordPresence: boolean;
}

export const DEFAULT_DESKTOP_PREFS: DesktopPrefs = { closeToTray: true, startMinimized: true, discordPresence: true };

export function loadDesktopPrefs(): Promise<DesktopPrefs> {
  return invoke<DesktopPrefs>('desktop_prefs_load');
}

export function saveDesktopPrefs(prefs: DesktopPrefs): Promise<void> {
  return invoke('desktop_prefs_save', { prefs });
}

export const desktopAutostart = {
  isEnabled: autostartIsEnabled,
  enable: autostartEnable,
  disable: autostartDisable,
};

// ---- Discord -----------------------------------------------------------------------------------

/** What Discord shows under "Playing Strafe" (the shell owns the connection: src-tauri/src/discord.rs). */
export interface DiscordPresence {
  /** First line ("In a voice call"). */
  details?: string;
  /** Second line. */
  state?: string;
  /** Unix ms the activity started, for Discord's "elapsed" counter; the app's launch when absent. */
  since?: number;
}

export function setDiscordPresence(presence: DiscordPresence): Promise<void> {
  return invoke('desktop_discord_presence_set', { presence });
}

/** False when this build carries no Discord application ID, so the Settings toggle can say so. */
export function discordPresenceAvailable(): Promise<boolean> {
  return invoke<boolean>('desktop_discord_presence_available');
}
