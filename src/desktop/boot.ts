/**
 * Entry point of the desktop half of the client. Called once from App; a no-op in a
 * browser, so the web client never pays for any of it.
 */

import { createEffect, createMemo, createRoot } from 'solid-js';
import { desktopPlatform, isDesktop } from './env';
import { initDesktopAccounts } from './accounts';
import { markDesktopReady, nativeNotificationsGranted, setDiscordPresence, setUnreadBadge, type DiscordPresence } from './native';
import { scheduleDesktopUpdateChecks } from './updater';
import { readState } from '../stores/readState';
import { voice } from '../stores/voice';
import { t } from '../i18n';

let started = false;

export function initDesktop(): void {
  if (started || !isDesktop()) return;
  started = true;
  // Styling hooks: the title bar's height, and the traffic-light inset on macOS.
  document.documentElement.classList.add('desktop', `desktop-${desktopPlatform()}`);
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

  scheduleDesktopUpdateChecks();

  createRoot(() => {
    // Unread mentions on the app icon, summed over every room we know about.
    const total = createMemo(() => Object.values(readState.byRoom).reduce((n, r) => n + (r.mentionCount || 0), 0));
    createEffect(() => {
      const n = total();
      void setUnreadBadge(n).catch(() => undefined);
    });

    // What Discord shows under "Playing Strafe": whether we are in a call, and since when.
    // That is all Discord ever learns - never which space, room or instance. The shell
    // decides whether to show anything at all (the Settings toggle, the window being open).
    let callSince = 0;
    createEffect(() => {
      const status = voice.session.status;
      const inCall = (status === 'connected' || status === 'reconnecting') && voice.session.roomId !== null;
      if (!inCall) callSince = 0;
      else if (!callSince) callSince = Date.now();
      const presence: DiscordPresence = inCall ? { details: t('desktop.discord.inCall'), since: callSince } : {};
      void setDiscordPresence(presence).catch(() => undefined);
    });
  });

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
