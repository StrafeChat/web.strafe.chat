import type { OlmMachine } from '@matrix-org/matrix-sdk-crypto-wasm';
import { getMachine, getCurrentDeviceId } from './machine';
import { processOutgoingRequests, receiveToDeviceMessages, drainPendingToDevice, noteOneTimeKeyCounts } from './transport';
import { ensureRoomKeyShared, encryptForRoom, decryptForRoom, invalidateRoomSession, type RoomEventMeta } from './rooms';
import { listOwnDevices, uploadKeys, type DeviceInfo } from '../../api/devices';
import {
  PLAINTEXT_PREFIX,
  MEGOLM_CIPHERTEXT_PREFIX,
  OLM_CIPHERTEXT_PREFIX,
  LEGACY_DUAL_CIPHERTEXT_PREFIX,
  LEGACY_GROUP_CIPHERTEXT_PREFIX,
  toMatrixUserId,
} from './constants';

export { getOwnFingerprint, getPeerDevices, markDeviceVerified, clearDeviceVerification } from './safety';
export type { DeviceSafetyInfo } from './safety';

// Key backup: asymmetric, opened only by the user's recovery code. See keyBackup.ts.
export {
  prepareKeyBackup,
  commitKeyBackup,
  syncKeyBackup,
  restoreKeyBackup,
  resetKeyBackup,
  getBackupStatus,
  startBackupSync,
  scheduleBackupSync,
  stopBackupSync,
  NoBackupError,
  RecoveryCodeMismatchError,
} from './keyBackup';
export type { BackupStatus, PreparedKeyBackup } from './keyBackup';
export {
  hasLegacyPinBackup,
  importLegacyPinBackup,
  deleteLegacyPinBackup,
  LegacyPinMismatchError,
  LegacyBackupUnreadableError,
  NoLegacyBackupError,
} from './legacyBackup';

/**
 * How often ensureDevice re-checks the server's copy of this device and polls for
 * to-device messages that arrived while offline. Live traffic reaches the engine through
 * TO_DEVICE gateway events, so these two requests only matter after a gap - they used to
 * run on every channel open, two extra round trips per navigation for nothing.
 */
const DEVICE_SYNC_INTERVAL_MS = 60_000;
let lastDeviceSyncAt = 0;

/**
 * Ensure this user's device/OlmMachine exists and has flushed any pending outgoing
 * requests (initial key upload on a brand-new device, replenishment on an existing one).
 * Cheap to call before every send or decrypt: the server-side checks are throttled.
 */
export async function ensureDevice(userId: string): Promise<OlmMachine> {
  const machine = await getMachine(userId);
  await processOutgoingRequests(machine);
  const deviceId = getCurrentDeviceId();
  if (deviceId && Date.now() - lastDeviceSyncAt > DEVICE_SYNC_INTERVAL_MS) {
    lastDeviceSyncAt = Date.now();
    await ensureServerHasDeviceKeys(machine, userId, deviceId);
    await drainPendingToDevice(machine, deviceId);
  }
  return machine;
}

/** Force the next ensureDevice to sync with the server again - called when the gateway
 * (re)connects, since anything sent to this device while it was offline has not been seen. */
export async function resyncDevice(userId: string): Promise<void> {
  lastDeviceSyncAt = 0;
  await ensureDevice(userId);
}

/** Matrix canonical JSON: sorted keys, no whitespace - what signatures are computed over. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

/**
 * Rebuild this device's signed device-keys claim (the `device_keys` object of a Matrix
 * /keys/upload) from the account the engine holds. The engine only produces this once, at
 * account creation, and then treats the keys as uploaded for good.
 */
async function buildDeviceKeys(machine: OlmMachine, userId: string, deviceId: string): Promise<Record<string, unknown>> {
  const claim: Record<string, unknown> = {
    algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
    device_id: deviceId,
    keys: {
      [`curve25519:${deviceId}`]: machine.identityKeys.curve25519.toBase64(),
      [`ed25519:${deviceId}`]: machine.identityKeys.ed25519.toBase64(),
    },
    user_id: toMatrixUserId(userId),
  };
  const signatures = await machine.sign(canonicalJson(claim));
  return { ...claim, signatures: JSON.parse(signatures.asJSON()) };
}

/** Unconditionally (re-)upload this device's signed key claim, whatever the server thinks it
 * already has. The engine produces the claim once at account creation and then treats the
 * keys as uploaded for good, so re-publishing has to be driven from here. */
export async function republishDeviceKeys(machine: OlmMachine, userId: string, deviceId: string): Promise<void> {
  const keys = await buildDeviceKeys(machine, userId, deviceId);
  const res = await uploadKeys(deviceId, { device_keys: keys });
  noteOneTimeKeyCounts(res.one_time_key_counts ?? {});
  // The pool of one-time keys may be gone too; let the engine top it up on its next turn.
  await processOutgoingRequests(machine);
}

/**
 * The server keeps this device's signed key claim so peers can encrypt to it. If the server
 * lost it (a table restored from backup, a dropped table) nobody can reach this device and
 * the engine would never notice - it considers the keys uploaded. Re-publish; the existing
 * Olm/Megolm sessions in the local store stay valid because the identity keys are unchanged.
 */
export async function ensureServerHasDeviceKeys(machine: OlmMachine, userId: string, deviceId: string): Promise<void> {
  let devices: DeviceInfo[];
  try {
    devices = await listOwnDevices();
  } catch (e) {
    console.warn('[e2ee] could not verify server-side device keys', e);
    return;
  }
  const mine = devices.find((d) => d.device_id === deviceId);
  if (mine?.has_keys) return;
  console.warn('[e2ee] server has no keys for device', deviceId, mine ? '(row present)' : '(row missing)', '- re-uploading');
  await republishDeviceKeys(machine, userId, deviceId);
}

/**
 * Encrypt plaintext for a room (PM, group PM, or an E2EE-enabled space channel - all the
 * same Megolm path; a PM is just a 2-member room). memberUserIds must include the
 * current user themselves, so the app's own other devices - and this device's own later
 * re-reads of its sent messages - can decrypt too, replacing the old design's separate
 * "encrypt once for the recipient, once for myself" duplication.
 */
export async function encryptMessage(
  userId: string,
  roomId: string,
  memberUserIds: string[],
  plaintext: string,
  extra?: Record<string, unknown>
): Promise<string> {
  const machine = await getMachine(userId);
  await ensureRoomKeyShared(machine, roomId, memberUserIds);
  return encryptForRoom(machine, roomId, plaintext, extra);
}

export interface DecryptedResult {
  plaintext: string;
  /** True if this used the old (pre-ratchet) scheme - never produced going forward, kept only for reading history. */
  legacy: boolean;
  /** True if we don't have the room key yet (e.g. the to-device share hasn't arrived) - caller should show a placeholder, not an error. */
  pending: boolean;
  /** Everything else that was inside the encrypted content (e.g. `attachments`). */
  content?: Record<string, unknown>;
}

/** Decrypt a message, dispatching on its wire-format prefix. `meta` supplies the sender/
 * event-id/timestamp decryptForRoom needs to rebuild the Matrix event envelope Megolm
 * decryption expects - see rooms.ts. Legacy (pre-rewrite) ciphertext formats are handled
 * by the caller via isLegacyCiphertext(); this function only understands the current
 * Megolm format (and the plaintext passthrough prefix). */
export async function decryptMessage(userId: string, roomId: string, ciphertext: string, meta: RoomEventMeta): Promise<DecryptedResult> {
  if (ciphertext.startsWith(PLAINTEXT_PREFIX)) {
    return { plaintext: ciphertext.slice(PLAINTEXT_PREFIX.length), legacy: false, pending: false };
  }
  if (ciphertext.startsWith(MEGOLM_CIPHERTEXT_PREFIX)) {
    const machine = await getMachine(userId);
    const inner = ciphertext.slice(MEGOLM_CIPHERTEXT_PREFIX.length);
    try {
      const result = await decryptForRoom(machine, roomId, inner, meta);
      return { plaintext: result.plaintext, legacy: false, pending: false, content: result.content };
    } catch (e) {
      console.warn('[e2ee] decrypt pending/failed for event', meta.eventId, e);
      return { plaintext: '', legacy: false, pending: true };
    }
  }
  throw new Error('unrecognized ciphertext format');
}

/** Force the next send in this room to establish a fresh Megolm session, shared only
 * with its current members. Call when a SESSION_ROTATE gateway event arrives. */
export async function rotateRoomSession(userId: string, roomId: string): Promise<void> {
  const machine = await getMachine(userId);
  await invalidateRoomSession(machine, roomId);
}

export function isLegacyCiphertext(ciphertext: string): boolean {
  return (
    ciphertext.startsWith(LEGACY_DUAL_CIPHERTEXT_PREFIX) ||
    ciphertext.startsWith(LEGACY_GROUP_CIPHERTEXT_PREFIX) ||
    // Very old messages predate any prefix at all and are raw base64 ciphertext from the
    // original static-ECDH scheme - anything that doesn't match a known current prefix
    // and isn't valid JSON-after-prefix falls back to the legacy decrypt path too.
    (!ciphertext.startsWith(PLAINTEXT_PREFIX) &&
      !ciphertext.startsWith(MEGOLM_CIPHERTEXT_PREFIX) &&
      !ciphertext.startsWith(OLM_CIPHERTEXT_PREFIX))
  );
}

/** Feed a live to-device push (from the gateway) into the machine. */
export async function handleIncomingToDevice(
  userId: string,
  message: { id: string; type: string; sender_user_id: string; sender_device_id: string; sender_fid?: string; content: unknown }
): Promise<void> {
  const machine = await getMachine(userId);
  const deviceId = getCurrentDeviceId();
  if (!deviceId) return;
  await receiveToDeviceMessages(machine, deviceId, [message]);
}
