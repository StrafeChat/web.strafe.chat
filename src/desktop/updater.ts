/**
 * In-app updates, the Discord way: checked quietly in the background, downloaded while
 * you keep chatting, and installed only when you say "restart now" - never mid-sentence.
 * Signed releases are published alongside the web client (see .github/workflows and
 * src-tauri/tauri.conf.json for the endpoint and key).
 */

import { createStore } from 'solid-js/store';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

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

let pending: Update | null = null;
let inflight: Promise<void> | null = null;

function describe(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function downloadPending(): Promise<void> {
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
      const u = await check({ timeout: 15_000 });
      setDesktopUpdate('lastCheckedAt', Date.now());
      if (!u) {
        setDesktopUpdate({ status: 'upToDate' });
        return;
      }
      pending = u;
      setDesktopUpdate({ status: 'available', version: u.version, notes: u.body ?? '', dismissed: false });
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
