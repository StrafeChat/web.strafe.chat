/**
 * Server-side key backup, asymmetric: `m.megolm_backup.v1.curve25519-aes-sha2`.
 *
 * ## Why asymmetric
 *
 * The scheme this replaces was symmetric: one secret encrypted the backup, every device held
 * it, and the server held it wrapped under a 6-digit PIN. That has two problems, and they are
 * the two that matter.
 *
 * 1. **Every device could read the whole archive.** Anything that got into one browser -
 *    an XSS bug, a malicious extension, a stolen laptop - got the account's entire message
 *    history off the server, not just whatever that device happened to have locally.
 * 2. **A short secret guarded it.** A stolen database plus a million PIN guesses is the
 *    whole attack. No iteration count fixes that; it only sets the price.
 *
 * Here the backup has a *key pair*. Devices hold the public half, so they can keep adding
 * room keys and can never read what is there - the backup is append-only from the inside.
 * The private half exists only wrapped under the user's recovery code (see recoveryCode.ts),
 * which is 128 bits of CSPRNG output, so there is nothing left to guess.
 *
 * ## Deliberately not stored locally
 *
 * A restore has the decryption key in memory, and the engine offers saveBackupDecryptionKey()
 * to keep it in the crypto store - Element does this so devices can hand the key to each
 * other. This module does not call it. Keeping it would put the read capability back on the
 * device and give away most of point 1 above; the cost is that a device which wants to
 * re-download the backup later asks for the code again, which is rare and cheap.
 *
 * ## What the server sees
 *
 * The public key, the wrapped private key, and per-session ciphertext. Nothing that can
 * decrypt a message, and nothing worth brute-forcing.
 */

import {
  BackupDecryptionKey,
  OlmMachine,
  RequestType,
  RoomId,
} from '@matrix-org/matrix-sdk-crypto-wasm';
import {
  BACKUP_ALGORITHM,
  createBackupVersion,
  deleteBackupVersion,
  getBackupKeys,
  getBackupRecovery,
  getBackupVersion,
  putBackupKeys,
  type BackupRecoveryResponse,
  type BackupVersionResponse,
} from '../../api/devices';
import { ApiError } from '../../api/ApiError';
import { getMachine } from './machine';
import { generateRecoveryCode, unwrapBackupKey, wrapBackupKey } from './recoveryCode';
import { E2eeUnavailableError } from './subtle';

/** The recovery code did not open this backup: wrong code, or the wrong account's code. */
export class RecoveryCodeMismatchError extends Error {
  constructor() {
    super('recovery code does not match this backup');
    this.name = 'RecoveryCodeMismatchError';
  }
}

/** The account has no backup to restore from. */
export class NoBackupError extends Error {
  constructor() {
    super('no key backup exists for this account');
    this.name = 'NoBackupError';
  }
}

/**
 * The backup version this session has told the engine to encrypt to. Tracked so a sync
 * doesn't re-issue enableBackupV1 on every call, and so a 404 or a KEY_BACKUP_UPDATE
 * (another device replaced the version) can clear it and force a re-read.
 */
let enabledVersion: string | null = null;

/**
 * The version this *device* last uploaded to, across reloads.
 *
 * The engine marks each room key as backed up, and that mark survives enableBackupV1 - it
 * is only cleared by disableBackup(). So when the backup version changes (the user got a new
 * recovery code, or another device replaced it), every key still looks uploaded and
 * backupRoomKeys() returns nothing: the new backup would sit permanently empty while the UI
 * reported it was on. Knowing which version those marks refer to is what decides whether the
 * marks have to be cleared, and the engine does not expose it - so it is recorded here.
 */
const ENABLED_VERSION_KEY = 'strafe_e2ee_backup_version';

/**
 * The backup version this device has proof for: it created it (commitKeyBackup) or opened
 * it with the recovery code (restoreKeyBackup). Whoever holds a version's private key reads
 * every room key uploaded to it, and the server decides which version is "current" - so a
 * stolen session token, or the server itself, could replace the backup with a key of its own
 * and wait for every device to upload its history. A version without proof gets nothing.
 */
const BACKUP_PIN_KEY = 'strafe_e2ee_backup_pin';
interface BackupPin {
  version: string;
  publicKey: string;
}
function pinnedBackup(userId: string): BackupPin | null {
  try {
    const raw = localStorage.getItem(`${BACKUP_PIN_KEY}:${userId}`);
    return raw ? (JSON.parse(raw) as BackupPin) : null;
  } catch {
    return null;
  }
}
function pinBackup(userId: string, version: string, publicKey: string): void {
  try {
    localStorage.setItem(`${BACKUP_PIN_KEY}:${userId}`, JSON.stringify({ version, publicKey } satisfies BackupPin));
  } catch {
    // Storage unavailable: the backup still works for this page's life; the next load asks again.
  }
}
/** The server's current version when it is not one this device trusts (see enableFrom). */
let untrustedVersion: string | null = null;

function lastEnabledVersion(userId: string): string | null {
  try {
    return localStorage.getItem(`${ENABLED_VERSION_KEY}:${userId}`);
  } catch {
    // Unreadable: treat as "unknown", which errs toward re-uploading rather than toward an
    // empty backup.
    return null;
  }
}

function rememberEnabledVersion(userId: string, version: string): void {
  try {
    localStorage.setItem(`${ENABLED_VERSION_KEY}:${userId}`, version);
  } catch {
    // Worst case the next load re-uploads keys the backup already has, which the server
    // deduplicates.
  }
}

/** Upload loop bound. Each pass covers a batch of sessions; this only exists so a server
 * that keeps rejecting a version can't spin forever. */
const MAX_UPLOAD_BATCHES = 50;

/** Restore loop bound, at the server's page size - far above any real backup, and only here
 * so a server that kept handing back cursors could not spin forever. */
const MAX_RESTORE_PAGES = 200;

function isVersionGone(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

/**
 * Point the engine at the account's current backup version, so backupRoomKeys() starts
 * producing sessions encrypted to it. Returns the version, or null if the account has no
 * backup yet.
 *
 * Once this session knows the version it stops re-reading it: syncs run on a timer and on
 * every burst of arriving room keys, and a request per sync was enough traffic to trip the
 * endpoint's own rate limit on a busy account - at which point syncing silently stopped. A
 * version replaced elsewhere is still picked up, via the 404 that the next upload gets.
 */
async function ensureBackupEnabled(machine: OlmMachine, userId: string): Promise<string | null> {
  if (enabledVersion && (await machine.isBackupEnabled())) return enabledVersion;
  const info = await getBackupVersion();
  // Re-upload everything if these keys' backed-up marks belong to a different version.
  return enableFrom(machine, userId, info, lastEnabledVersion(userId) !== info.version);
}

/**
 * Tell the engine which public key to encrypt room keys to.
 *
 * `resetBackedUpMarks` clears every key's "already backed up" flag, which is required
 * whenever the marks currently refer to some other version - otherwise nothing is ever
 * uploaded to the new one. It must NOT be set right after importing from a backup: that
 * import already marked the keys for this same version, and clearing them would re-upload
 * the entire history that was just downloaded.
 */
async function enableFrom(
  machine: OlmMachine,
  userId: string,
  info: BackupVersionResponse | BackupRecoveryResponse,
  resetBackedUpMarks: boolean
): Promise<string | null> {
  if (!info.exists || !info.version || !info.auth_data?.public_key) return null;
  if (info.algorithm && info.algorithm !== BACKUP_ALGORITHM) {
    console.warn('[e2ee] ignoring key backup with unsupported algorithm', info.algorithm);
    return null;
  }
  if (enabledVersion === info.version && (await machine.isBackupEnabled())) return info.version;
  const pin = pinnedBackup(userId);
  if (!pin || pin.publicKey !== info.auth_data.public_key) {
    if (untrustedVersion !== info.version) {
      console.warn('[e2ee] key backup version', info.version, 'was not created or unlocked on this device; not uploading to it until the recovery code confirms it');
    }
    untrustedVersion = info.version;
    enabledVersion = null;
    return null;
  }
  untrustedVersion = null;
  if (resetBackedUpMarks) await machine.disableBackup();
  await machine.enableBackupV1(info.auth_data.public_key, info.version);
  enabledVersion = info.version;
  rememberEnabledVersion(userId, info.version);
  return info.version;
}

export interface BackupStatus {
  exists: boolean;
  version: string | null;
  /** Sessions the *server* holds. */
  backedUp: number;
  /** Sessions this device holds in total. */
  total: number;
  /** Sessions this device still has to upload, per the engine's own bookkeeping. */
  pending: number;
  /**
   * The server's backup was set up on another device and this one has not opened it with
   * the recovery code, so it uploads nothing to it (see enableFrom). Restoring confirms it.
   */
  untrusted: boolean;
  /**
   * The engine believes it has uploaded more than the server actually has.
   *
   * Only happens when the two have disagreed about which version the "backed up" marks refer
   * to, which is exactly the failure that makes a backup silently stay empty while reporting
   * that it is on. Surfaced rather than hidden so the UI can offer the fix.
   */
  outOfSync: boolean;
}

/** What to show in settings: whether a backup exists and how far behind it is. */
export async function getBackupStatus(userId: string): Promise<BackupStatus> {
  const machine = await getMachine(userId);
  const [info, counts] = await Promise.all([getBackupVersion(), machine.roomKeyCounts()]);
  const pending = Math.max(0, counts.total - counts.backedUp);
  return {
    exists: info.exists,
    version: info.version ?? null,
    backedUp: info.count ?? 0,
    total: counts.total,
    pending,
    untrusted: info.exists && !!info.version && pinnedBackup(userId)?.publicKey !== info.auth_data?.public_key,
    outOfSync: info.exists && pending === 0 && (info.count ?? 0) < counts.total,
  };
}

/**
 * A backup that has been generated but not yet created on the server. See prepareKeyBackup.
 */
export interface PreparedKeyBackup {
  /** The code to show the user. Nothing anywhere can print it again once this is discarded. */
  code: string;
  publicKey: string;
  wrapped: string;
  salt: string;
}

/**
 * Generate a backup's key pair and recovery code, without touching the server.
 *
 * Split from commitKeyBackup so the code can be shown *before* anything is created. Doing it
 * the other way round meant a user who closed the dialog - or whose tab died while it was
 * open - was left with a backup nobody could ever open, which settings then reported as "On.
 * A new device can restore your message history", and which had already replaced whatever
 * backup they had before. Now backing out of the dialog leaves the account exactly as it was.
 */
export async function prepareKeyBackup(): Promise<PreparedKeyBackup> {
  const decryptionKey = BackupDecryptionKey.createRandomKey();
  try {
    const publicKey = decryptionKey.megolmV1PublicKey.publicKeyBase64;
    const code = await generateRecoveryCode();
    const { wrapped, salt } = await wrapBackupKey(decryptionKey.toBase64(), code);
    // Note the absence of saveBackupDecryptionKey: see the module comment. Past this point the
    // decryption key exists only inside `wrapped`, and only the code opens it.
    return { code, publicKey, wrapped, salt };
  } finally {
    // Release the wasm handle rather than leaving the private key sitting in linear memory
    // for the rest of the page's life. Wasm allocations are not garbage collected.
    decryptionKey.free();
  }
}

/**
 * Create the prepared backup on the server and upload this device's room keys to it.
 *
 * Replaces the account's current backup. The server keeps the replaced version for seven
 * days rather than deleting it outright: a replacement nobody asked for - a hijacked
 * session, a mistaken "start over" - would otherwise destroy the only copy of the history,
 * and restoreKeyBackup can still open the retained one with its code. `password` is the
 * account password, asked for again because a session token alone must not be enough to
 * point every device's uploads at a new key.
 */
export async function commitKeyBackup(userId: string, prepared: PreparedKeyBackup, password: string): Promise<string> {
  const machine = await getMachine(userId);
  const { version } = await createBackupVersion({
    algorithm: BACKUP_ALGORITHM,
    auth_data: { public_key: prepared.publicKey },
    wrapped_private_key: prepared.wrapped,
    salt: prepared.salt,
    password,
  });
  // This device made it: the one proof that needs no code.
  pinBackup(userId, version, prepared.publicKey);

  // resetBackedUpMarks, always: every key this device holds is marked as backed up to the
  // version this one just replaced, and without clearing those marks the new backup stays
  // empty forever while the UI reports it is on.
  await enableFrom(
    machine,
    userId,
    { exists: true, version, algorithm: BACKUP_ALGORITHM, auth_data: { public_key: prepared.publicKey } },
    true
  );
  await syncKeyBackup(userId);
  return version;
}

/**
 * Upload every room key this device holds that the backup does not. Needs no secret - that
 * is the point of the asymmetric scheme - so it can run on a timer without ever prompting.
 * Returns how many sessions were sent.
 */
export function syncKeyBackup(userId: string): Promise<number> {
  // Serialised, because four things can ask for a sync at once: the periodic sweep, the
  // debounce that fires when room keys arrive, backup creation, and the settings page.
  // Concurrent callers would each get the *same* pending request out of backupRoomKeys(),
  // upload it twice, and then both mark a request id the engine had already retired.
  //
  // Keyed by user so that a call for a different account can never be handed back the result
  // of one already running for the previous one.
  if (!syncInFlight || syncInFlightUserId !== userId) {
    syncInFlightUserId = userId;
    syncInFlight = runSyncKeyBackup(userId).finally(() => {
      if (syncInFlightUserId === userId) {
        syncInFlight = null;
        syncInFlightUserId = null;
      }
    });
  }
  return syncInFlight;
}

let syncInFlight: Promise<number> | null = null;
let syncInFlightUserId: string | null = null;

async function runSyncKeyBackup(userId: string): Promise<number> {
  const machine = await getMachine(userId);
  if (!(await ensureBackupEnabled(machine, userId))) return 0;

  let uploaded = 0;
  let batch = 0;
  for (; batch < MAX_UPLOAD_BATCHES; batch++) {
    const req = await machine.backupRoomKeys();
    if (!req) return uploaded;
    let res: { count: number; etag: string };
    try {
      res = await putBackupKeys(req.version, req.body);
    } catch (e) {
      if (!isVersionGone(e)) throw e;
      // Another device (or this user in settings) replaced the backup. Adopt the new
      // version and let the loop retry; the engine re-encrypts to the new public key.
      console.info('[e2ee] key backup version was replaced; adopting the current one');
      enabledVersion = null;
      if (!(await ensureBackupEnabled(machine, userId))) return uploaded;
      continue;
    }
    await machine.markRequestAsSent(req.id, RequestType.KeysBackup, JSON.stringify(res));
    uploaded += countSessions(req.body);
  }
  // Ran out of batches with work still queued. Harmless - the next sweep continues - but
  // silence here would hide a backup that never catches up.
  console.warn('[e2ee] key backup sync stopped after', batch, 'batches; more keys remain for the next pass');
  return uploaded;
}

function countSessions(body: string): number {
  try {
    const parsed = JSON.parse(body) as { rooms?: Record<string, { sessions?: Record<string, unknown> }> };
    let n = 0;
    for (const room of Object.values(parsed.rooms ?? {})) n += Object.keys(room.sessions ?? {}).length;
    return n;
  } catch {
    return 0;
  }
}

/** A recovery response that actually carries a version to unwrap. */
type RecoverableVersion = BackupRecoveryResponse & {
  version: string;
  wrapped_private_key: string;
  salt: string;
  auth_data: { public_key: string };
};

function isRecoverable(info: BackupRecoveryResponse): info is RecoverableVersion {
  return !!(info.exists && info.version && info.wrapped_private_key && info.salt && info.auth_data?.public_key);
}

/**
 * Read the backup with a recovery code and import its room keys into this device.
 *
 * The code is checked against the backup's public key before anything is downloaded, so a
 * wrong code is reported immediately and precisely instead of surfacing later as messages
 * that quietly fail to decrypt.
 *
 * If the code does not open the current version but the server still retains the one it
 * replaced, that one is tried too. A code that opens the *previous* version is what a
 * backup replaced by someone else looks like from the account holder's side - the retention
 * exists so their history is still there to read. Its keys are imported and that version
 * pinned (the code is proof enough), but nothing is enabled for upload: the current version
 * remains unconfirmed, so settings keeps saying it needs confirming until this code opens
 * it or the user creates a new backup. Only when neither version opens is the code wrong.
 *
 * Returns how many sessions were new to this device.
 */
export async function restoreKeyBackup(userId: string, code: string): Promise<number> {
  const info = await getBackupRecovery();
  if (!isRecoverable(info)) throw new NoBackupError();

  const decryptionKey = await unwrapWithCode(info, code);
  if (decryptionKey) {
    try {
      return await importFromBackup(userId, info, decryptionKey, true);
    } finally {
      // The backup's private key lives in wasm linear memory, which is not garbage collected -
      // without this it would stay readable for the rest of the page's life, on a device that
      // deliberately never persists it.
      decryptionKey.free();
    }
  }

  const previous = await retainedPreviousRecovery(info.version);
  const previousKey = previous && (await unwrapWithCode(previous, code));
  if (!previous || !previousKey) throw new RecoveryCodeMismatchError();
  console.info('[e2ee] the recovery code opens the retained previous backup version, not the current one; restoring from it');
  try {
    return await importFromBackup(userId, previous, previousKey, false);
  } finally {
    previousKey.free();
  }
}

/** The version's private key if `code` opens its wrapped copy, else null. */
async function unwrapWithCode(info: RecoverableVersion, code: string): Promise<BackupDecryptionKey | null> {
  try {
    return BackupDecryptionKey.fromBase64(await unwrapBackupKey(info.wrapped_private_key, info.salt, code));
  } catch (e) {
    // Web Crypto missing (an insecure context) is not a wrong code, and must not be reported
    // as one - that tells someone their code is bad when the problem is how they reached the
    // app. Everything else here is a failed AES-GCM tag (wrong code) or a corrupt row.
    if (e instanceof E2eeUnavailableError) throw e;
    return null;
  }
}

/**
 * Recovery material of the version the current one replaced, while the server retains it
 * (seven days). Null when there is none, or it expired between the two requests.
 */
async function retainedPreviousRecovery(currentVersion: string): Promise<RecoverableVersion | null> {
  const { previous } = await getBackupVersion();
  if (!previous?.version || previous.version === currentVersion) return null;
  let info: BackupRecoveryResponse;
  try {
    info = await getBackupRecovery(previous.version);
  } catch (e) {
    if (isVersionGone(e)) return null;
    throw e;
  }
  return isRecoverable(info) && info.version === previous.version ? info : null;
}

/**
 * `enableUploads` points the engine at this version afterwards so keys this device acquires
 * later reach the same backup. Off for a retained previous version: it is on its way out,
 * and uploading to it would hide the unconfirmed current version behind a backup that stops
 * existing in a week.
 */
async function importFromBackup(
  userId: string,
  info: RecoverableVersion,
  decryptionKey: BackupDecryptionKey,
  enableUploads: boolean
): Promise<number> {
  const { version } = info;
  const publicKey = info.auth_data.public_key;
  // The published public key has to be the one the unwrapped private key belongs to. A row
  // whose two halves disagree is corrupt - or a server pairing the user's own wrapped key
  // with a public key of someone else's, hoping the match below gets it trusted.
  if (decryptionKey.megolmV1PublicKey.publicKeyBase64 !== publicKey) {
    throw new RecoveryCodeMismatchError();
  }
  // The code opened it, so the key behind this version is the account holder's: trust it
  // from here on (see pinnedBackup).
  pinBackup(userId, version, publicKey);

  // The backup is read a page at a time: a busy account can hold tens of thousands of
  // sessions, and asking for all of them at once would be a response of tens of megabytes on
  // the one request a restore cannot afford to have fail.
  // Accumulated by room-id *string*: a room can span a page boundary, and RoomId is a wasm
  // handle with no value equality, so a Map keyed by it would never find the earlier page's
  // entry and the second half of that room would silently replace the first.
  const byRoom = new Map<string, Map<string, unknown>>();
  let failed = 0;
  let total = 0;
  let cursor: string | undefined;
  for (let page = 0; page < MAX_RESTORE_PAGES; page++) {
    const res = await getBackupKeys(version, cursor);
    for (const [roomId, room] of Object.entries(res.rooms ?? {})) {
      let sessions = byRoom.get(roomId);
      if (!sessions) {
        sessions = new Map<string, unknown>();
        byRoom.set(roomId, sessions);
      }
      for (const [sessionId, entry] of Object.entries(room.sessions ?? {})) {
        total++;
        const data = entry.session_data;
        if (!data?.ephemeral || !data.mac || !data.ciphertext) {
          failed++;
          continue;
        }
        try {
          sessions.set(sessionId, JSON.parse(decryptionKey.decryptV1(data.ephemeral, data.mac, data.ciphertext)));
        } catch (e) {
          // One damaged session must not cost the user the rest of their history.
          failed++;
          console.warn('[e2ee] could not decrypt a backed-up session', sessionId, e);
        }
      }
    }
    cursor = res.next;
    if (!cursor) break;
  }
  if (cursor) console.warn('[e2ee] stopped reading the key backup after', MAX_RESTORE_PAGES, 'pages');
  if (failed > 0) console.warn('[e2ee]', failed, 'of', total, 'backed-up sessions could not be read');

  const decrypted = new Map<RoomId, Map<string, unknown>>();
  for (const [roomId, sessions] of byRoom) {
    if (sessions.size > 0) decrypted.set(new RoomId(roomId), sessions);
  }

  const machine = await getMachine(userId);
  // This device's own keys may carry "backed up" marks for an older version - the backup
  // was replaced from another device. Those marks have to go *before* the import, which
  // then marks only what it brings in for this version. Left in place (enableFrom below
  // switches versions without clearing, and correctly so for the imported keys), any key
  // only this device holds would never reach the new backup, and with the version now
  // recorded as current nothing later would notice.
  if (lastEnabledVersion(userId) !== version) {
    await machine.disableBackup();
    enabledVersion = null;
  }
  const result = await machine.importBackedUpRoomKeys(decrypted as Map<RoomId, Map<string, any>>, () => {}, version);

  // Keep contributing to the same backup from now on, so keys this device acquires later are
  // recoverable too. No reset: the import above already marked these keys as backed up to
  // this very version, and clearing that would immediately re-upload everything just read.
  if (enableUploads) {
    await enableFrom(machine, userId, info, false);
  } else {
    // This device may still have been pointed at the version just read, from before it
    // learnt of the replacement. Forgetting that makes the next sync re-read the server's
    // current version and judge it on its own pin.
    enabledVersion = null;
  }

  return Number(result.importedCount ?? 0);
}

/**
 * Discard the account's current backup and everything in it - "I lost my recovery code".
 * Immediate, unlike a replacement: there is no code left that could ever open it. Needs the
 * account password again (see createBackupVersion).
 */
export async function resetKeyBackup(password: string): Promise<void> {
  const info = await getBackupVersion();
  if (!info.exists || !info.version) return;
  await deleteBackupVersion(info.version, password);
  enabledVersion = null;
}

/**
 * The gateway says the account's backup version was created or deleted elsewhere
 * (KEY_BACKUP_UPDATE). Forget which version the engine was pointed at, so the next sync
 * re-reads the server's and - unless this device created or unlocked it - refuses to upload
 * to it at once, rather than at the 404 the next upload would have met. The engine itself is
 * left alone: a pinned version that comes back unchanged is simply re-enabled.
 */
export function noteBackupVersionChanged(): void {
  enabledVersion = null;
}

// --- Keeping the backup current
//
// Uploading needs no secret, so this can run unattended for the life of the session. The
// interval is the upper bound on how much recent history a restore could miss.

const SYNC_INTERVAL_MS = 5 * 60_000;
/** Coalescing delay for a sync triggered by key arrival, so a burst of room keys is one upload. */
const SYNC_DEBOUNCE_MS = 10_000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncUserId: string | null = null;

/**
 * Users whose backup flow has already run this session.
 *
 * Kept here, beside the rest of the backup's session state, so that stopBackupSync() can
 * clear it on sign-out: it lives in the one module the auth store can import without a
 * cycle. When it was a Set in the bootstrap store nothing reset it, so signing out and back
 * into the same account in one page life skipped the flow entirely - no restore prompt, and
 * no startBackupSync, leaving the backup unsynced for the rest of the session.
 */
const bootstrappedUsers = new Set<string>();

/** True if the backup flow still needs to run for this user in this session. */
export function claimBackupBootstrap(userId: string): boolean {
  if (bootstrappedUsers.has(userId)) return false;
  bootstrappedUsers.add(userId);
  return true;
}

function runSync(userId: string): void {
  syncKeyBackup(userId).catch((e) => console.warn('[e2ee] key backup sync failed', e));
}

export function startBackupSync(userId: string): void {
  syncUserId = userId;
  if (syncTimer) return;
  syncTimer = setInterval(() => runSync(userId), SYNC_INTERVAL_MS);
}

/**
 * Room keys just arrived (a to-device share). Get them into the backup soon rather than at the
 * next sweep, coalescing a burst into one upload. No-op before startBackupSync.
 */
export function scheduleBackupSync(): void {
  const userId = syncUserId;
  if (!userId || debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runSync(userId);
  }, SYNC_DEBOUNCE_MS);
}

/** Stop syncing and forget this session's backup state (sign-out). */
export function stopBackupSync(): void {
  if (syncTimer) clearInterval(syncTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  syncTimer = null;
  debounceTimer = null;
  syncUserId = null;
  enabledVersion = null;
  syncInFlight = null;
  syncInFlightUserId = null;
  bootstrappedUsers.clear();
}
