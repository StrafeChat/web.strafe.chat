/**
 * The native shell, as the web client needs it: window chrome, the system browser,
 * notifications, the taskbar badge, start-up preferences. Every function here assumes it
 * runs inside the desktop app (callers gate on isDesktop()).
 *
 * Two shells sit under the same functions: Tauri on Windows and macOS, reached through
 * `@tauri-apps/api`, and Electron on Linux, reached through the bridge its preload exposes
 * (electronBridge.ts). Each function asks the bridge first and otherwise does what it always
 * did under Tauri, so no caller needs to know which one it got - and nothing calls a Tauri
 * API inside Electron, where there is no Tauri to answer.
 */

import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { disable as autostartDisable, enable as autostartEnable, isEnabled as autostartIsEnabled } from '@tauri-apps/plugin-autostart';
import { desktopPlatform } from './env';
import { electronBridge, type ScreenSource } from './electronBridge';

export type { ScreenSource } from './electronBridge';

/**
 * The Electron shell's bridge, or null under Tauri (and in a browser). The preload exposes it
 * before any page script runs, so it is settled by the time this module loads.
 */
const electron = electronBridge();

/**
 * A bridge call as a promise, the shape the Tauri API gives for the same thing - and a throw
 * from the bridge becomes a rejection, as a failed Tauri call would be.
 */
async function bridged<T>(run: () => T | Promise<T>): Promise<T> {
  return run();
}

// ---- window --------------------------------------------------------------------------------

export const desktopWindow = {
  minimize: (): Promise<void> => (electron ? bridged(() => electron.window.minimize()) : getCurrentWindow().minimize()),
  toggleMaximize: (): Promise<void> =>
    electron ? bridged(() => electron.window.toggleMaximize()) : getCurrentWindow().toggleMaximize(),
  /** The shell decides what close means (quit, or hide to the tray - Settings -> Desktop). */
  close: (): Promise<void> => (electron ? bridged(() => electron.window.close()) : getCurrentWindow().close()),
  isMaximized: (): Promise<boolean> => (electron ? electron.window.isMaximized() : getCurrentWindow().isMaximized()),
  /** Calls back with the maximised state whenever the window is resized. */
  onMaximizeChange(cb: (maximized: boolean) => void): Promise<() => void> {
    if (electron) return bridged(() => electron.window.onMaximizeChange(cb));
    const w = getCurrentWindow();
    return w.onResized(() => {
      void w.isMaximized().then(cb);
    });
  },
  isPopup: (): boolean => (electron ? electron.isPopup : getCurrentWindow().label.startsWith('popup-')),
};

/** The page has painted: the shell may show the window (it starts hidden). */
export function markDesktopReady(): Promise<void> {
  if (electron) return bridged(() => electron.ready());
  return invoke('desktop_ready');
}

/** The installed app's version (StrafeChat/desktop), which is not the web client's build. */
export function desktopAppVersion(): Promise<string> {
  if (electron) return Promise.resolve(electron.appVersion);
  return getVersion();
}

// ---- links and windows -----------------------------------------------------------------------

/** A link to somewhere else opens in the system browser, as it should in an app. */
export function openExternalUrl(url: string): Promise<void> {
  if (electron) return electron.openExternal(url);
  return openUrl(url);
}

/**
 * `url` as a path inside this app (path, query and fragment) when it points at the app
 * itself, else null. Scheme and host are compared rather than `origin`, which reads "null"
 * for a custom scheme like the shell's tauri://localhost wherever the URL parser does not
 * know the scheme is a standard one.
 */
function inAppPath(url: string): string | null {
  try {
    const u = new URL(url, window.location.href);
    if (u.protocol !== window.location.protocol || u.host !== window.location.host) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/**
 * An in-app page in its own small window (the OAuth consent screen a bot install opens).
 * A browser would open a tab; a desktop app opens a window.
 */
export function openPopupWindow(url: string, opts: { width?: number; height?: number; title?: string } = {}): void {
  if (electron) {
    // The Electron shell opens only its own pages in a window, by path, so a page can never
    // ask it to load something from elsewhere inside the app. A link to anywhere else is a
    // link like any other, and goes to the system browser.
    const path = inAppPath(url);
    if (path) electron.window.openPopup(path, opts);
    else void electron.openExternal(url).catch(() => undefined);
    return;
  }
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
  if (electron) return bridged(() => electron.window.close());
  return getCurrentWindow().close();
}

// ---- notifications --------------------------------------------------------------------------

// The Electron shell posts notifications from its main process, which needs no permission
// from the page, so there the answer is yes from the start.
let granted: boolean | null = electron ? true : null;

/** Cached answer of the last permission check; null until one has run. */
export function nativeNotificationsGrantedSync(): boolean | null {
  return granted;
}

export async function nativeNotificationsGranted(): Promise<boolean> {
  if (electron) {
    granted = true;
    return granted;
  }
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
  if (electron) {
    electron.notify(title, body);
    return;
  }
  sendNotification({ title, body });
}

/** Ask for attention (taskbar flash, dock bounce) when the window is not in front. */
export async function flashWindow(): Promise<void> {
  if (electron) {
    // The shell checks focus itself before it flashes.
    electron.window.requestAttention();
    return;
  }
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
  if (electron) {
    electron.setBadgeCount(Math.max(0, count));
    return;
  }
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
  if (electron) return electron.prefs.load();
  return invoke<DesktopPrefs>('desktop_prefs_load');
}

export function saveDesktopPrefs(prefs: DesktopPrefs): Promise<void> {
  if (electron) return electron.prefs.save(prefs);
  return invoke('desktop_prefs_save', { prefs });
}

/** Start at login - the autostart plugin under Tauri, an XDG autostart entry under Electron. */
export const desktopAutostart = {
  isEnabled: (): Promise<boolean> => (electron ? electron.autostart.isEnabled() : autostartIsEnabled()),
  enable: (): Promise<void> => (electron ? electron.autostart.enable() : autostartEnable()),
  disable: (): Promise<void> => (electron ? electron.autostart.disable() : autostartDisable()),
};

// ---- storage ------------------------------------------------------------------------------------

/**
 * Wipe the webview's IndexedDB for the app origin and relaunch. The Electron shell clears the
 * origin's storage from its main process and relaunches. Under Tauri only the Linux app can:
 * its shell does it at the next start, before the webview exists, because WebKit's database
 * server crashes on a store it cannot read and takes every in-page deletion down with it (see
 * E2eeEnvironmentModal). On Windows and macOS nothing at start-up would honour the request,
 * so the shell rejects it rather than restart onto the same store; the page deletes its own
 * store there, as in a browser. Never resolves on success: the process restarts.
 */
export function wipeWebviewStorageAndRestart(): Promise<void> {
  if (electron) return electron.wipeStorageAndRestart();
  return invoke('desktop_wipe_webview_storage');
}

// ---- Discord -----------------------------------------------------------------------------------

/**
 * What Discord shows under "Playing Strafe" (the shell owns the connection: src-tauri/src/discord.rs,
 * and its port in the Electron shell).
 */
export interface DiscordPresence {
  /** First line ("In a voice call"). */
  details?: string;
  /** Second line. */
  state?: string;
  /** Unix ms the activity started, for Discord's "elapsed" counter; the app's launch when absent. */
  since?: number;
}

export function setDiscordPresence(presence: DiscordPresence): Promise<void> {
  if (electron) return bridged(() => electron.discord.set(presence));
  return invoke('desktop_discord_presence_set', { presence });
}

/** False when this build carries no Discord application ID, so the Settings toggle can say so. */
export function discordPresenceAvailable(): Promise<boolean> {
  if (electron) return electron.discord.available();
  return invoke<boolean>('desktop_discord_presence_available');
}

// ---- screen share ------------------------------------------------------------------------------

/**
 * What the app's own screen-share picker can offer, or null when there is nothing for it to
 * do: under Tauri the webview's getDisplayMedia shows the system's picker, and under Electron
 * on Wayland the desktop portal does. Only Electron on X11 leaves the choice to the app.
 */
export function screenShareSources(): Promise<ScreenSource[] | null> {
  if (electron) return electron.screen.sources();
  return Promise.resolve(null);
}

/** The source the next getDisplayMedia call shares (one of `screenShareSources`). */
export function chooseScreenShareSource(id: string): Promise<void> {
  if (electron) return electron.screen.choose(id);
  return Promise.resolve();
}

// ---- games (activity) --------------------------------------------------------------------------

/*
 * The shell recognises the game being played (the process list never leaves it) and tells the
 * page only what to share: the game's name and when it started, after the person's hides and
 * renames, or null. Sharing is off until turned on, per desktop account, and while it is off
 * the shell does not look at all. Tauri: the games_* commands and an `activity-changed` event on
 * the main window. Electron: the bridge's optional `games` member. Both answer only the main
 * window. A shell from before this has neither, and gamesAvailable() says so.
 *
 * Wire shapes are snake_case (started_at, detected_name), as the shells send them.
 */

/** What the shell says to share now. */
export interface GameActivity {
  name: string;
  /** Unix ms the game's first process started (0 when unknown). */
  started_at: number;
}

/** The game being shared, with its key: exactly the last `activity-changed` payload. */
export interface CurrentGame extends GameActivity {
  key: string;
}

export type GameSource = 'steam' | 'epic' | 'heroic' | 'lutris' | 'curated' | 'user';

/** A game this device knows about: customised, added, or running now. */
export interface GameRow {
  /** `steam:<appid>`, `epic:<AppName>`, `heroic:<runner>:<app_name>`, `lutris:<slug>`, `curated:<id>` or `user:<id>`. Never a path. */
  key: string;
  /** The name that is shared (the rename, when there is one). */
  name: string;
  /** The name it was recognised by. */
  detected_name: string;
  source: GameSource;
  hidden: boolean;
  renamed: boolean;
  running: boolean;
}

export interface GamesState {
  /** Sharing is on for `account`. */
  share: boolean;
  /** The desktop account (`${domain}:${userId}`) the shell takes as signed in now - the one
   * `share` and `current` are for - or null when there is none. A page must report a game
   * only when this is its own account: around a switch the shell may already be on the
   * next one. */
  account: string | null;
  /** Null when sharing is off, nothing is running, or the game is hidden. */
  current: CurrentGame | null;
  games: GameRow[];
}

/** A program running now, for "Add it": an opaque id the shell maps back to the program for a
 * few minutes, and the program's file name. Never its path, command line or environment. */
export interface RunningProgram {
  id: string;
  name: string;
}

const GAME_SOURCES: ReadonlySet<string> = new Set(['steam', 'epic', 'heroic', 'lutris', 'curated', 'user']);

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function startedAt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** The activity-changed payload, or null when it is not one. */
function toGameActivity(v: unknown): GameActivity | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const name = str(o.name);
  return name ? { name, started_at: startedAt(o.started_at) } : null;
}

function toGameRow(v: unknown): GameRow | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const key = str(o.key);
  const name = str(o.name);
  if (!key || !name) return null;
  const source = str(o.source);
  return {
    key,
    name,
    detected_name: str(o.detected_name) || name,
    source: (GAME_SOURCES.has(source) ? source : 'curated') as GameSource,
    hidden: o.hidden === true,
    renamed: o.renamed === true,
    running: o.running === true,
  };
}

function toGamesState(v: unknown): GamesState {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const cur = toGameActivity(o.current);
  const key = o.current && typeof o.current === 'object' ? str((o.current as Record<string, unknown>).key) : '';
  return {
    share: o.share === true,
    account: typeof o.account === 'string' && o.account ? o.account : null,
    // The key is for the Settings page; what to share does not depend on it.
    current: cur ? { ...cur, key } : null,
    games: Array.isArray(o.games) ? o.games.map(toGameRow).filter((g): g is GameRow => g !== null) : [],
  };
}

let gamesProbe: Promise<boolean> | null = null;

/**
 * Whether this shell can detect games: Electron has the bridge member, Tauri answers
 * games_get_state. False in a browser, in an older desktop build, and in a popup window (the
 * shell answers the main window only). A yes is remembered; a no is asked again next time.
 */
export function gamesAvailable(): Promise<boolean> {
  if (electron) return Promise.resolve(!electron.isPopup && typeof electron.games?.getState === 'function');
  if (!('__TAURI_INTERNALS__' in window) || desktopWindow.isPopup()) return Promise.resolve(false);
  if (!gamesProbe) {
    gamesProbe = invoke('games_get_state').then(
      () => true,
      () => {
        gamesProbe = null;
        return false;
      },
    );
  }
  return gamesProbe;
}

function electronGames() {
  const g = electron?.games;
  if (!g) throw new Error('This version of Strafe Desktop cannot detect games.');
  return g;
}

/** The share switch, the game being shared and the games list. Never scans. */
export async function gamesGetState(): Promise<GamesState> {
  if (electron) return toGamesState(await bridged(() => electronGames().getState()));
  return toGamesState(await invoke('games_get_state'));
}

/** Sharing on or off for one desktop account (`activeDesktopAccountId()`); off stops the scanner. */
export async function gamesSetShare(on: boolean, account: string): Promise<void> {
  if (electron) {
    await bridged(() => electronGames().setShare(on, account));
    return;
  }
  await invoke('games_set_share', { on, account });
}

export async function gamesSetHidden(key: string, hidden: boolean): Promise<void> {
  if (electron) {
    await bridged(() => electronGames().setHidden(key, hidden));
    return;
  }
  await invoke('games_set_hidden', { key, hidden });
}

/** Share the game under another name; null goes back to the detected one. */
export async function gamesRename(key: string, name: string | null): Promise<void> {
  if (electron) {
    await bridged(() => electronGames().rename(key, name));
    return;
  }
  await invoke('games_rename', { key, name });
}

/** Programs running now, for "Add it". Asked for when the picker opens; nothing is kept. */
export async function gamesRunningPrograms(): Promise<RunningProgram[]> {
  const raw: unknown = electron ? await bridged(() => electronGames().runningPrograms()) : await invoke('games_running_programs');
  if (!Array.isArray(raw)) return [];
  const out: RunningProgram[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const id = str((p as Record<string, unknown>).id);
    const name = str((p as Record<string, unknown>).name);
    if (id && name) out.push({ id, name });
  }
  return out;
}

/** Make a running program (by its id from gamesRunningPrograms) a game with this name. */
export async function gamesAdd(id: string, name: string): Promise<GameRow | null> {
  const raw: unknown = electron ? await bridged(() => electronGames().add(id, name)) : await invoke('games_add', { id, name });
  return toGameRow(raw);
}

/** Forget a game the person added (`user:` keys only). */
export async function gamesRemove(key: string): Promise<void> {
  if (electron) {
    await bridged(() => electronGames().remove(key));
    return;
  }
  await invoke('games_remove', { key });
}

/**
 * Calls back with what to share whenever it changes: the game, or null. Not buffered: a page
 * that starts after the shell found a game reads gamesGetState().current first.
 */
export async function onActivityChanged(cb: (activity: GameActivity | null) => void): Promise<() => void> {
  if (electron) return bridged(() => electronGames().onActivityChanged((v) => cb(toGameActivity(v))));
  return getCurrentWebviewWindow().listen<unknown>('activity-changed', (e) => cb(toGameActivity(e.payload)));
}
