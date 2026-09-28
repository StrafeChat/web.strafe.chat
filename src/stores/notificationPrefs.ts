/**
 * Notification preferences (per device, localStorage) and the two primitives the rest of
 * the app uses to notify: a desktop notification and a synthesised chime (no audio asset
 * to ship - a short two-note tone from the Web Audio API).
 */

import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_notifications';

export type SpaceNotifyMode = 'all' | 'mentions' | 'none';
export type PmNotifyMode = 'all' | 'none';

export interface NotificationPrefs {
  /** Desktop (system) notifications for new messages. */
  desktop: boolean;
  /** Include the message text in the notification body. */
  preview: boolean;
  /** Also notify for the room that is on screen while the window is focused. */
  whileFocused: boolean;
  sounds: boolean;
  /** 0..1 */
  volume: number;
  /** Default for space rooms; a space's own "only mentions" default narrows `all`. */
  spaceMode: SpaceNotifyMode;
  pmMode: PmNotifyMode;
}

const DEFAULTS: NotificationPrefs = {
  desktop: false,
  preview: true,
  whileFocused: false,
  sounds: true,
  volume: 0.6,
  spaceMode: 'mentions',
  pmMode: 'all',
};

function load(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<NotificationPrefs>;
      return {
        desktop: p.desktop ?? DEFAULTS.desktop,
        preview: p.preview ?? DEFAULTS.preview,
        whileFocused: p.whileFocused ?? DEFAULTS.whileFocused,
        sounds: p.sounds ?? DEFAULTS.sounds,
        volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : DEFAULTS.volume,
        spaceMode: p.spaceMode === 'all' || p.spaceMode === 'none' || p.spaceMode === 'mentions' ? p.spaceMode : DEFAULTS.spaceMode,
        pmMode: p.pmMode === 'none' ? 'none' : 'all',
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export const [notificationPrefs, setNotificationPrefsStore] = createStore<NotificationPrefs>(load());

export function setNotificationPrefs(patch: Partial<NotificationPrefs>): void {
  setNotificationPrefsStore(patch);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...notificationPrefs }));
  } catch {
    /* ignore */
  }
}

export type DesktopPermission = NotificationPermission | 'unsupported';

export function desktopPermission(): DesktopPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

let audioCtx: AudioContext | null = null;

/** Two-note chime (E5 → A5). Volume 0..1; nothing plays at 0 or when Web Audio is missing. */
export function playNotificationSound(volume = notificationPrefs.volume): void {
  if (volume <= 0 || typeof window === 'undefined') return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  try {
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18 * volume;
    master.connect(ctx.destination);
    const note = (freq: number, at: number, dur: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    };
    note(659.25, t0, 0.18);
    note(880, t0 + 0.12, 0.28);
  } catch {
    /* ignore */
  }
}

export interface DesktopNotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  /** Same tag replaces the previous notification (one per room). */
  tag?: string;
  onClick?: () => void;
}

/** Shows a system notification when permission has been granted. Returns whether it was shown. */
export function showDesktopNotification(opts: DesktopNotificationOptions): boolean {
  if (desktopPermission() !== 'granted') return false;
  try {
    const n = new Notification(opts.title, { body: opts.body, icon: opts.icon || undefined, tag: opts.tag, silent: true });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
