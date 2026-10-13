/**
 * Entry point of the desktop half of the client. Called once from App; a no-op in a
 * browser, so the web client never pays for any of it.
 */

import { createEffect, createMemo, createRoot } from 'solid-js';
import { desktopPlatform, desktopShell, isDesktop } from './env';
import { initDesktopAccounts } from './accounts';
import { desktopWindow, markDesktopReady, nativeNotificationsGranted, setDiscordPresence, setUnreadBadge, type DiscordPresence } from './native';
import { scheduleDesktopUpdateChecks } from './updater';
import { readState } from '../stores/readState';
import { voice } from '../stores/voice';
import { auth } from '../stores/auth';
import { instance } from '../stores/instance';
import { getDesktopInstance } from './instanceOverride';
import { t } from '../i18n';

let started = false;

export function initDesktop(): void {
  if (started || !isDesktop()) return;
  started = true;
  // Styling hooks: the title bar's height, the traffic-light inset on macOS, and the
  // drag regions only the Electron shell needs (Tauri drags by attribute instead).
  document.documentElement.classList.add('desktop', `desktop-${desktopPlatform()}`, `desktop-${desktopShell() ?? 'tauri'}`);
  // Before anything awaits, so a link dropped in the first seconds is not opened either.
  refuseUnhandledDrops();
  void start();
}

async function start(): Promise<void> {
  await initDesktopAccounts();

  // Show the window once the first frame is painted rather than on a blank webview.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void markDesktopReady().catch(() => undefined);
    });
  });

  // Prime the notification permission so showDesktopNotification can answer synchronously.
  void nativeNotificationsGranted();

  // One window checks for updates: a popup (the OAuth consent page) runs this same start-up,
  // and its own check would race the main window's download in the one updater there is.
  // The same goes for the badge and Discord: both are one per app, and a popup's stores are
  // its own and mostly empty - no call, few unread counts - so opening one mid-call wiped
  // "in a voice call" from Discord (and reset the badge), and closing it did not put it back.
  if (!desktopWindow.isPopup()) {
    scheduleDesktopUpdateChecks();
    installAppWideIndicators();
  }

  // The webview's own context menu (Back, Reload, Inspect...) is a browser's, not an app's.
  // Text fields keep it for spelling and paste; dev builds keep it everywhere for Inspect.
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
    });
  }
}

/**
 * A link or file dragged in from outside and let go where nothing in the app takes it must not
 * be opened by the webview. The Tauri windows leave drops to the engine (dragDropEnabled is off,
 * so the composer can take files), and the engine's answer to an unclaimed drop is to open it:
 * a link let go over the member list navigated the window to that page in place of the app,
 * with no title bar to get back by (the page draws it). The shells refuse file: navigations,
 * and Electron's refuses leaving the app at all, but under Tauri a dropped web link got through.
 * A link dropped into a text field is the field's to take: it is typed in.
 *
 * The refusal has to come after every handler in the app has had its say, and the composer
 * listens on window too (a file let go over the message list is attached): a listener added
 * here at start-up would run before it, since window runs its listeners in the order they were
 * added, and refuse the very drop the composer wanted. So each drag event, while still in its
 * capture phase at window, moves the refusal to the end of window's list, which puts it last
 * when that same event bubbles back up.
 */
function refuseUnhandledDrops(): void {
  const refuse = (e: DragEvent) => {
    if (e.defaultPrevented) return;
    const types = e.dataTransfer?.types;
    if (!types) return;
    const files = types.includes('Files');
    if (!files && !types.includes('text/uri-list')) return;
    const target = e.target instanceof Element ? e.target : e.target instanceof Node ? e.target.parentElement : null;
    if (!files && target?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
    e.preventDefault();
    // Cancelling dragover alone would show a drop as welcome; 'none' shows it refused.
    if (e.type === 'dragover' && e.dataTransfer) e.dataTransfer.dropEffect = 'none';
  };
  for (const type of ['dragover', 'drop'] as const) {
    window.addEventListener(
      type,
      () => {
        window.removeEventListener(type, refuse);
        window.addEventListener(type, refuse);
      },
      true,
    );
  }
}

/** The app icon's unread badge and the Discord presence: the main window's view only. */
function installAppWideIndicators(): void {
  createRoot(() => {
    // Unread mentions on the app icon, summed over every room we know about.
    const total = createMemo(() => Object.values(readState.byRoom).reduce((n, r) => n + (r.mentionCount || 0), 0));
    createEffect(() => {
      const n = total();
      void setUnreadBadge(n).catch(() => undefined);
    });

    // What Discord shows under "Playing Strafe": the tagline, and beneath it the instance the
    // person is signed in to (its own name for itself, or the host it was reached at), with
    // "in a voice call" and the call's start while one is on. Never a space or a room. The
    // shell decides whether to show anything at all (the Settings toggle, the window open).
    let callSince = 0;
    createEffect(() => {
      const status = voice.session.status;
      const inCall = (status === 'connected' || status === 'reconnecting') && voice.session.roomId !== null;
      if (!inCall) callSince = 0;
      else if (!callSince) callSince = Date.now();
      const domain = auth.user ? instance.domain || getDesktopInstance()?.domain || '' : '';
      const presence: DiscordPresence = {
        details: t('desktop.discord.tagline'),
        ...(domain ? { state: inCall ? t('desktop.discord.stateInCall', { domain }) : domain } : {}),
        ...(inCall ? { since: callSince } : {}),
      };
      void setDiscordPresence(presence).catch(() => undefined);
    });
  });
}
