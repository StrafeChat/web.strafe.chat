import { createSignal } from 'solid-js';

const [updateAvailable, setUpdateAvailable] = createSignal(false);
export { updateAvailable };

let started = false;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes, plus on tab focus

async function checkVersion(): Promise<void> {
  if (updateAvailable()) return; // already flagged; nothing changes until they reload
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { buildId?: string };
    if (data.buildId && data.buildId !== __BUILD_ID__) {
      setUpdateAvailable(true);
    }
  } catch {
    /* offline, or no version.json (dev) - ignore */
  }
}

/**
 * Poll /version.json for a build newer than the one this tab is running, and flip
 * `updateAvailable` when a deploy is detected so the UI can offer a refresh. Only meaningful
 * in production builds (dev emits no version.json). Safe to call more than once.
 */
export function initUpdateCheck(): void {
  if (started || import.meta.env.DEV) return;
  started = true;
  void checkVersion();
  setInterval(() => void checkVersion(), POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkVersion();
  });
  window.addEventListener('focus', () => void checkVersion());
}
