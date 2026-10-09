/**
 * When to ask about the key backup, and what to do with the answer.
 *
 * The design target is that a user coming from an app with no E2EE at all never has to think
 * about keys. Concretely:
 *
 *  - They never invent a secret. The recovery code is generated and shown once, with copy and
 *    download; the only ask is "save this".
 *  - They are never asked for it on a device that already works. Uploading to the backup
 *    needs only its public key (see lib/e2ee/keyBackup.ts), so the sync that keeps history
 *    recoverable runs silently forever.
 *  - The code is asked for in exactly one situation: a device with no keys of its own, for an
 *    account whose backup has some. That is a new browser or cleared storage - the cases
 *    where the alternative is silently unreadable history.
 *  - Nothing blocks the app. The prompts are dialogs over a working client; a message that
 *    can't be decrypted yet shows a placeholder and resolves itself once keys arrive.
 */

import {
  commitKeyBackup,
  deleteLegacyPinBackup,
  hasLegacyPinBackup,
  importLegacyPinBackup,
  LegacyBackupUnreadableError,
  LegacyPinMismatchError,
  NoBackupError,
  NoLegacyBackupError,
  prepareKeyBackup,
  RecoveryCodeMismatchError,
  resetKeyBackup,
  restoreKeyBackup,
  startBackupSync,
  syncKeyBackup,
} from '../lib/e2ee';
import { getMachine } from '../lib/e2ee/machine';
import { getBackupVersion } from '../api/devices';
import { confirmDialog } from './confirmDialog';
import { retryPendingDecrypts } from './messages';
import { E2eeUnavailableError } from '../lib/e2ee/subtle';
import { E2eeStoreUnusableError } from '../lib/e2ee/machine';
import {
  cancelRecoveryPrompt,
  promptLegacyPin,
  promptRecoveryCode,
  promptShowRecoveryCode,
  RecoveryPromptCancelled,
  setRecoveryPrompt,
  setRecoveryPromptError,
} from './recoveryPrompt';
import { t } from '../i18n';

/** Wrong-answer retries before giving up for this session. */
const ATTEMPTS = 3;

/**
 * A room still loading its history at the instant a restore imports its keys can land those
 * messages in the store as "waiting for keys" just after the one retry pass below runs -
 * which is why a restore sometimes left messages unreadable until a reload. One more sweep a
 * moment later closes that race; retrying is a no-op once nothing is still pending.
 */
const DECRYPT_RESWEEP_MS = 2500;
function scheduleDecryptResweep(): void {
  setTimeout(() => void retryPendingDecrypts().catch(() => {}), DECRYPT_RESWEEP_MS);
}

/**
 * Web Crypto is missing, so nothing here can run - typically the app was opened over a LAN
 * address, which is not a secure context. E2eeUnavailableError carries a real explanation
 * and a fix; until now nothing ever surfaced it, so this showed up as "something went wrong"
 * three times in a row on a device whose user had done nothing wrong.
 */
function handledAsEnvironmentFailure(e: unknown): boolean {
  return surfaceE2eeEnvironmentFailure(e);
}

/**
 * Show the person what is wrong with encryption on this device, if `e` is one of the two
 * failures that are the device's and not theirs: Web Crypto missing (above), or a local store
 * that cannot be opened (E2eeStoreUnusableError - the dialog offers the reset). Returns
 * whether it was one of those; anything else is the caller's to handle.
 */
export function surfaceE2eeEnvironmentFailure(e: unknown): boolean {
  if (e instanceof E2eeStoreUnusableError) {
    setRecoveryPrompt('e2eeStoreError', { store: e.storeName, detail: e.detail });
    cancelRecoveryPrompt();
    return true;
  }
  if (!(e instanceof E2eeUnavailableError)) return false;
  setRecoveryPrompt('e2eeEnvironmentError', e.message);
  cancelRecoveryPrompt();
  return true;
}

/**
 * Remember that the user declined to restore, keyed by backup version so that a *new* backup
 * asks again. Without this, someone who deliberately started fresh on a shared computer would
 * be nagged on every load.
 */
function declinedKey(userId: string, version: string): string {
  return `strafe_e2ee_restore_declined:${userId}:${version}`;
}

function hasDeclinedRestore(userId: string, version: string): boolean {
  try {
    return localStorage.getItem(declinedKey(userId, version)) === '1';
  } catch {
    return false;
  }
}

function markRestoreDeclined(userId: string, version: string): void {
  try {
    localStorage.setItem(declinedKey(userId, version), '1');
  } catch {
    // Worst case we ask again next load.
  }
}

/**
 * Decide and run whatever the account needs. Safe to call more than once; the caller
 * (e2eeBootstrap) does it once per user per session.
 */
export async function runBackupFlow(userId: string): Promise<void> {
  // Whatever happens below - a declined prompt, a failed request, a rate limit on the very
  // first read - the periodic sweep has to end up running. Without this a single transient
  // error at load left the backup unsynced for the rest of the session, silently.
  try {
    await decideBackupAction(userId);
  } finally {
    startBackupSync(userId);
  }
}

async function decideBackupAction(userId: string): Promise<void> {
  const info = await getBackupVersion();

  if (info.exists && info.version) {
    await restoreIfThisDeviceHasNothing(userId, info.version, info.count ?? 0);
    await syncKeyBackup(userId);
    // A legacy row alongside a current backup means a migration was interrupted, or a backup
    // was set up fresh while the old one was still there. Fold it in so its history isn't
    // stranded, then drop it.
    if (await hasLegacyPinBackup()) await foldInLegacyBackup(userId);
    return;
  }

  if (await hasLegacyPinBackup()) {
    await upgradeFromLegacyBackup(userId);
  } else {
    await offerToCreateBackup(userId);
  }
}

/**
 * Prompt for the recovery code only when this device holds no room keys at all and the
 * backup holds some - a new browser, or storage that was cleared.
 *
 * Deliberately not "this device is missing *some* keys": a device that can already read its
 * rooms should not be interrupted, and partial gaps (a device that was offline for a rotation)
 * are better handled by the user choosing Restore in settings than by a dialog they didn't ask
 * for.
 */
async function restoreIfThisDeviceHasNothing(userId: string, version: string, backupCount: number): Promise<void> {
  if (backupCount === 0) return;
  const machine = await getMachine(userId);
  const counts = await machine.roomKeyCounts();
  if (counts.total > 0) return;
  if (hasDeclinedRestore(userId, version)) return;
  await restoreWithPrompt(userId, version);
}

/**
 * Ask for the recovery code and import the backup. Returns the number of sessions imported,
 * or null if the user declined.
 */
export async function restoreWithPrompt(userId: string, version?: string): Promise<number | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const code = await promptRecoveryCode({ retainSubmitError: attempt > 0 });
      const imported = await restoreKeyBackup(userId, code);
      console.info('[e2ee] restored', imported, 'room keys from the key backup');
      // Messages already on screen showing "waiting for keys" can be read now.
      await retryPendingDecrypts();
      scheduleDecryptResweep();
      return imported;
    } catch (e) {
      if (e instanceof RecoveryPromptCancelled) {
        if (e.reason === 'lostCode') {
          await startOverWithNewBackup(userId);
          return null;
        }
        if (version) markRestoreDeclined(userId, version);
        return null;
      }
      if (e instanceof RecoveryCodeMismatchError) {
        setRecoveryPromptError(t('recovery.codeIncorrect'));
        continue;
      }
      if (e instanceof NoBackupError) return null;
      if (handledAsEnvironmentFailure(e)) return null;
      console.error('[e2ee] restore from key backup failed', e);
      setRecoveryPromptError(t('recovery.restoreFailed'));
    }
  }
  return null;
}

/**
 * The user no longer has their recovery code. Nothing can read the old backup - not us, not
 * the server - so the only way forward is to discard it and start a new one. Whatever history
 * existed only in that backup is gone with it, which is what the confirmation has to say.
 */
async function startOverWithNewBackup(userId: string): Promise<void> {
  const ok = await confirmDialog({
    title: t('recovery.lostCodeTitle'),
    body: t('recovery.lostCodeBody'),
    confirmLabel: t('recovery.lostCodeConfirm'),
    tone: 'danger',
    icon: 'fa-solid fa-key',
  });
  if (!ok) return;
  await resetKeyBackup();
  await createBackupWithPrompt(userId);
}

/**
 * Show the user a recovery code and, only once they confirm they have saved it, create the
 * backup it opens. Returns whether the backup was created.
 *
 * The order matters. Creating first and showing second meant that closing the dialog left an
 * account holding a backup nobody could open - reported in settings as "On", and having
 * already replaced whatever backup existed before. Preparing locally and committing on
 * confirmation makes backing out a true no-op.
 */
export async function createBackupWithPrompt(userId: string): Promise<boolean> {
  const prepared = await prepareKeyBackup();
  try {
    await promptShowRecoveryCode(prepared.code);
  } catch (e) {
    if (e instanceof RecoveryPromptCancelled) {
      console.info('[e2ee] recovery code was not saved; nothing was changed');
      return false;
    }
    throw e;
  }
  await commitKeyBackup(userId, prepared);
  return true;
}

/** First time an account sets a backup up. Declining is fine - E2EE keeps working, history
 * just isn't recoverable on a new device, and settings offers it again later. */
async function offerToCreateBackup(userId: string): Promise<void> {
  try {
    await createBackupWithPrompt(userId);
  } catch (e) {
    // Generating a code needs Web Crypto too, so an insecure context fails here as well -
    // with an explanation worth showing rather than a line in the console.
    if (handledAsEnvironmentFailure(e)) return;
    console.warn('[e2ee] could not set up a key backup', e);
  }
}

/**
 * Account predates the asymmetric backup: unlock the old PIN backup, import its keys, then
 * create the new backup (which uploads them) and delete the old row. See lib/e2ee/legacyBackup.ts
 * for why the old row cannot simply be left behind.
 */
async function upgradeFromLegacyBackup(userId: string): Promise<void> {
  const imported = await importLegacyWithPrompt(userId);
  if (imported === null) return; // declined - asked again next session
  const created = await createBackupWithPrompt(userId);
  if (!created) return; // no code in the user's hands yet; keep the old backup as the fallback
  await dropLegacyBackup();
}

/** A legacy row still present alongside a working new backup. Same steps, minus creating. */
async function foldInLegacyBackup(userId: string): Promise<void> {
  const imported = await importLegacyWithPrompt(userId);
  if (imported === null) return;
  await syncKeyBackup(userId);
  await dropLegacyBackup();
}

async function dropLegacyBackup(): Promise<void> {
  try {
    await deleteLegacyPinBackup();
    console.info('[e2ee] the old PIN-based backup has been replaced and deleted');
  } catch (e) {
    console.warn('[e2ee] could not delete the old PIN-based backup', e);
  }
}

/**
 * Ask for the legacy PIN and import that backup's keys. Returns the count, or null if the
 * user declined. "I don't have my PIN" deletes the old backup after confirmation, since
 * nothing can read it and it is a copy of the account's history guarded by six digits.
 */
export async function importLegacyWithPrompt(userId: string): Promise<number | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const pin = await promptLegacyPin({ retainSubmitError: attempt > 0 });
      const imported = await importLegacyPinBackup(userId, pin);
      console.info('[e2ee] imported', imported, 'room keys from the old PIN backup');
      if (imported > 0) {
        await retryPendingDecrypts();
        scheduleDecryptResweep();
      }
      return imported;
    } catch (e) {
      if (e instanceof RecoveryPromptCancelled) {
        if (e.reason === 'lostCode') {
          const ok = await confirmDialog({
            title: t('recovery.lostPinTitle'),
            body: t('recovery.lostPinBody'),
            confirmLabel: t('recovery.lostPinConfirm'),
            tone: 'danger',
            icon: 'fa-solid fa-key',
          });
          if (ok) await dropLegacyBackup();
        }
        return null;
      }
      if (e instanceof LegacyPinMismatchError) {
        setRecoveryPromptError(t('recovery.incorrectPin'));
        continue;
      }
      // The PIN was accepted; the backup itself is the problem. Asking again would blame the
      // user for a correct answer, so stop and offer to be rid of the unreadable row instead.
      if (e instanceof LegacyBackupUnreadableError) {
        console.error('[e2ee] the old PIN backup unlocked but could not be read', e.cause);
        const ok = await confirmDialog({
          title: t('recovery.legacyUnreadableTitle'),
          body: t('recovery.legacyUnreadableBody'),
          confirmLabel: t('recovery.lostPinConfirm'),
          tone: 'danger',
          icon: 'fa-solid fa-key',
        });
        if (ok) await dropLegacyBackup();
        return null;
      }
      if (e instanceof NoLegacyBackupError) return null;
      if (handledAsEnvironmentFailure(e)) return null;
      console.error('[e2ee] could not import the old PIN backup', e);
      setRecoveryPromptError(t('recovery.restoreFailed'));
    }
  }
  return null;
}

/** Replace the account's backup with a fresh one and show the new code (settings action). */
export async function regenerateBackupWithPrompt(userId: string): Promise<boolean> {
  const ok = await confirmDialog({
    title: t('recovery.replaceTitle'),
    body: t('recovery.replaceBody'),
    confirmLabel: t('recovery.replaceConfirm'),
    icon: 'fa-solid fa-key',
  });
  if (!ok) return false;
  return createBackupWithPrompt(userId);
}
