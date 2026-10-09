/**
 * Wires the key-backup flow into device bootstrap: make sure this browser has a device, then
 * let stores/e2eeBackup decide whether anything needs asking.
 *
 * This used to hook *into* device provisioning, because restoring meant taking over the old
 * device's identity and its local store, which had to happen before the crypto engine opened.
 * The asymmetric backup removed that constraint - a restoring browser is simply a new device
 * that imports room keys - so the flow now runs alongside a working client instead of
 * blocking it, and the ordering hazard (a message load provisioning a device while the restore
 * dialog was still on screen) is gone with it.
 */
import { ensureDevice } from '../lib/e2ee';
import { claimBackupBootstrap } from '../lib/e2ee/keyBackup';
import { runBackupFlow, surfaceE2eeEnvironmentFailure } from './e2eeBackup';

/** Runs once per user per session; sign-out clears the claim so a re-login runs it again. */
export async function bootstrapE2EEDevice(userId: string): Promise<void> {
  if (!claimBackupBootstrap(userId)) return;

  try {
    await ensureDevice(userId);
  } catch (e) {
    // A store this device cannot open, or no Web Crypto: tell the person (with the way out)
    // rather than leaving a blank safety number and unreadable rooms to speak for it.
    if (surfaceE2eeEnvironmentFailure(e)) return;
    throw e;
  }

  try {
    await runBackupFlow(userId);
  } catch (e) {
    console.warn('[e2ee] key backup flow failed', e);
  }
}
