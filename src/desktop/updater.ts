/**
 * In-app updates, the Discord way: checked quietly in the background, downloaded while
 * you keep chatting, and installed only when you say "restart now" - never mid-sentence.
 * Signed releases are published alongside the web client (see .github/workflows and
 * src-tauri/tauri.conf.json for the endpoint and key).
 *
 * Under Tauri the updater plugin does the work in this page. Under the Electron shell
 * (Linux) the shell checks, downloads, verifies the signature and installs, and this side
 * only walks the same states, so the banner and Settings -> Desktop read one store either way.
 */

import { createStore } from 'solid-js/store';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { electronBridge, type UpdateInfo } from './electronBridge';

export type DesktopUpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'ready' | 'installing' | 'error';

export interface DesktopUpdateState {
  status: DesktopUpdateStatus;
  version: string;
  notes: string;
  /** 0-100 while downloading. */
  progress: number;
  error: string;
  lastCheckedAt: number;
  /** The banner was waved away; the settings page still offers the restart. */
  dismissed: boolean;
}

export const [desktopUpdate, setDesktopUpdate] = createStore<DesktopUpdateState>({
  status: 'idle',
  version: '',
  notes: '',
  progress: 0,
  error: '',
  lastCheckedAt: 0,
  dismissed: false,
});

/** The Electron shell's bridge, or null under Tauri; settled before this module loads. */
const electron = electronBridge();

/** The Tauri plugin's handle on the update found. Under Electron the shell keeps its own. */
let pending: Update | null = null;
let inflight: Promise<void> | null = null;

function describe(e: unknown): string {
  if (typeof e === 'string') return e;
  // Electron wraps a rejection from the main process as "Error invoking remote method
  // '<channel>': Error: <message>"; the person only needs the message.
  if (e instanceof Error) return e.message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '');
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function downloadPending(): Promise<void> {
  if (electron) {
    setDesktopUpdate({ status: 'downloading', progress: 0 });
    // Held at 99 until download() resolves, which is after the shell has checked the
    // signature - the same way the Tauri path below waits for its Finished event.
    await electron.updater.download((percent) => {
      setDesktopUpdate('progress', Math.max(0, Math.min(99, Math.round(percent))));
    });
    setDesktopUpdate({ status: 'ready', progress: 100 });
    return;
  }
  const u = pending;
  if (!u) return;
  setDesktopUpdate({ status: 'downloading', progress: 0 });
  let total = 0;
  let got = 0;
  await u.download((ev) => {
    if (ev.event === 'Started') {
      total = ev.data.contentLength ?? 0;
    } else if (ev.event === 'Progress') {
      got += ev.data.chunkLength;
      if (total > 0) setDesktopUpdate('progress', Math.min(99, Math.round((got / total) * 100)));
    } else if (ev.event === 'Finished') {
      setDesktopUpdate('progress', 100);
    }
  });
  setDesktopUpdate({ status: 'ready', progress: 100 });
}

/** The Tauri plugin's answer, keeping its handle on the update to download and install. */
async function checkTauri(): Promise<UpdateInfo | null> {
  const u = await check({ timeout: 15_000 });
  if (!u) return null;
  pending = u;
  return { version: u.version, notes: u.body ?? '' };
}

/**
 * Ask the release feed whether something newer exists and, if so, fetch it. Safe to call
 * from anywhere, any number of times: one check runs at a time and a downloaded update
 * is kept until it is installed.
 */
export function checkForDesktopUpdate(): Promise<void> {
  if (inflight) return inflight;
  const st = desktopUpdate.status;
  if (st === 'downloading' || st === 'ready' || st === 'installing') return Promise.resolve();
  inflight = (async () => {
    setDesktopUpdate({ status: 'checking', error: '' });
    try {
      const u = await (electron ? electron.updater.check() : checkTauri());
      setDesktopUpdate('lastCheckedAt', Date.now());
      if (!u) {
        setDesktopUpdate({ status: 'upToDate' });
        return;
      }
      setDesktopUpdate({ status: 'available', version: u.version, notes: u.notes, dismissed: false });
      await downloadPending();
    } catch (e) {
      setDesktopUpdate({ status: 'error', error: describe(e), lastCheckedAt: Date.now() });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Install what was downloaded and come back as the new version. */
export async function installDesktopUpdate(): Promise<void> {
  if (electron) {
    if (desktopUpdate.status !== 'ready') return;
    setDesktopUpdate('status', 'installing');
    try {
      // The shell installs and relaunches, and the page goes with it, so "installing" is the
      // last state this shows. A deb or rpm install asks for the system password first;
      // refusing it lands in the catch.
      await electron.updater.install();
    } catch (e) {
      setDesktopUpdate({ status: 'error', error: describe(e) });
    }
    return;
  }
  const u = pending;
  if (!u || desktopUpdate.status !== 'ready') return;
  setDesktopUpdate('status', 'installing');
  try {
    await u.install();
    // Windows runs the installer and exits the app itself; elsewhere we relaunch.
    await relaunch();
  } catch (e) {
    setDesktopUpdate({ status: 'error', error: describe(e) });
  }
}

export function dismissDesktopUpdate(): void {
  setDesktopUpdate('dismissed', true);
}

let scheduled = false;
const FIRST_CHECK_MS = 15_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;
const FOCUS_RECHECK_MS = 60 * 60 * 1000;

/** Check shortly after start-up, every few hours after, and on focus when it has been a while. */
export function scheduleDesktopUpdateChecks(): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => void checkForDesktopUpdate(), FIRST_CHECK_MS);
  setInterval(() => void checkForDesktopUpdate(), INTERVAL_MS);
  window.addEventListener('focus', () => {
    if (Date.now() - desktopUpdate.lastCheckedAt > FOCUS_RECHECK_MS) void checkForDesktopUpdate();
  });
}
