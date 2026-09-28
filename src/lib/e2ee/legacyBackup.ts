/**
 * The old PIN-wrapped backup, read-only.
 *
 * Accounts that existed before the asymmetric backup (keyBackup.ts) have their history's
 * room keys here: a random store passphrase encrypted under a 6-digit PIN, plus a Megolm
 * session export encrypted under that passphrase. Nothing writes this format any more -
 * its whole problem was that a stolen database plus a million PIN guesses opened it - but
 * it has to stay readable long enough to fold those keys into the new backup once, or
 * upgrading would silently cost people their old messages.
 *
 * After a successful import the row is deleted (see deleteLegacyPinBackup): leaving it
 * behind would keep a brute-forceable copy of the same history on the server, which is
 * exactly what the new scheme exists to stop.
 */

import { getKeyBackup, deleteKeyBackup } from '../../api/devices';
import { E2eeUnavailableError, getSubtleCrypto } from './subtle';
import { b64Decode } from './util';
import { getMachine, importRoomKeys } from './machine';

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const ROOM_KEY_INFO = 'strafe-room-key-backup-v1';

/** The PIN did not open the backup. */
export class LegacyPinMismatchError extends Error {
  constructor() {
    super('recovery PIN does not match this backup');
    this.name = 'LegacyPinMismatchError';
  }
}

/**
 * The PIN was right but the backup's contents could not be read - a damaged blob, or one
 * written by a version of the old format this no longer understands.
 *
 * Separate from LegacyPinMismatchError so the caller stops asking: re-prompting for a PIN
 * that was already correct tells the user they got it wrong when they did not.
 */
export class LegacyBackupUnreadableError extends Error {
  constructor(cause?: unknown) {
    super('the old backup unlocked but its contents could not be read');
    this.name = 'LegacyBackupUnreadableError';
    this.cause = cause;
  }
}

/** This account has no old backup to import. */
export class NoLegacyBackupError extends Error {
  constructor() {
    super('no legacy PIN backup exists for this account');
    this.name = 'NoLegacyBackupError';
  }
}

/** Map common Unicode digits to ASCII so mobile keyboards match desktop PBKDF2 input. */
function normalizePin(pin: string): string {
  const s = pin.normalize('NFKC').trim();
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      if (cp >= 0x0660 && cp <= 0x0669) return String.fromCodePoint(0x30 + (cp - 0x0660));
      if (cp >= 0x06f0 && cp <= 0x06f9) return String.fromCodePoint(0x30 + (cp - 0x06f0));
      if (cp >= 0xff10 && cp <= 0xff19) return String.fromCodePoint(0x30 + (cp - 0xff10));
      return ch;
    })
    .join('');
}

async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const material = await subtle.importKey('raw', new TextEncoder().encode(normalizePin(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.slice(0), iterations: PBKDF2_ITERATIONS },
    material,
    256
  );
  return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** The room-key half was wrapped with the store passphrase, via HKDF rather than PBKDF2 -
 * that passphrase was already 256 bits of CSPRNG output, so there was nothing to stretch. */
async function deriveKeyFromPassphrase(storePassphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const material = await subtle.importKey('raw', new TextEncoder().encode(storePassphrase), 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt.slice(0), info: new TextEncoder().encode(ROOM_KEY_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptRoomKeys(blob: string, storePassphrase: string): Promise<string> {
  const combined = b64Decode(blob);
  if (combined.length < SALT_LENGTH + IV_LENGTH) throw new Error('invalid room key backup: too short');
  const key = await deriveKeyFromPassphrase(storePassphrase, combined.slice(0, SALT_LENGTH));
  const plaintext = await getSubtleCrypto().decrypt(
    { name: 'AES-GCM', iv: combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH), tagLength: TAG_LENGTH },
    key,
    combined.slice(SALT_LENGTH + IV_LENGTH)
  );
  return new TextDecoder().decode(plaintext);
}

/** Whether this account still has an un-migrated PIN backup. */
export async function hasLegacyPinBackup(): Promise<boolean> {
  try {
    const res = await getKeyBackup();
    return res.exists === true;
  } catch {
    return false;
  }
}

/**
 * Unlock the old backup with its PIN and import its room keys into this device. Returns how
 * many sessions were new here - zero is a valid outcome for a backup written before the old
 * scheme carried key material at all, and still means the PIN was correct.
 */
export async function importLegacyPinBackup(userId: string, pin: string): Promise<number> {
  const res = await getKeyBackup();
  if (!res.exists || !res.encrypted_backup || !res.salt) throw new NoLegacyBackupError();

  let storePassphrase: string;
  try {
    const saltBytes = b64Decode(res.salt);
    const key = await deriveKeyFromPin(pin, saltBytes);
    const combined = b64Decode(res.encrypted_backup);
    if (combined.length < IV_LENGTH) throw new Error('invalid backup: too short');
    const plaintext = await getSubtleCrypto().decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, IV_LENGTH), tagLength: TAG_LENGTH },
      key,
      combined.slice(IV_LENGTH)
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as { storePassphrase?: string };
    if (typeof parsed.storePassphrase !== 'string') throw new Error('invalid backup: missing fields');
    storePassphrase = parsed.storePassphrase;
  } catch (e) {
    // A missing Web Crypto (insecure context) is not a wrong PIN and must not be reported as
    // one; see the matching note in keyBackup.restoreKeyBackup.
    if (e instanceof E2eeUnavailableError) throw e;
    throw new LegacyPinMismatchError();
  }

  if (!res.room_keys) return 0;
  // Past this point the PIN is known to be correct, so anything that fails is a problem with
  // the stored data rather than with what the user typed - and must not be reported as one.
  try {
    const exported = await decryptRoomKeys(res.room_keys, storePassphrase);
    const machine = await getMachine(userId);
    return await importRoomKeys(machine, exported);
  } catch (e) {
    throw new LegacyBackupUnreadableError(e);
  }
}

/** Remove the old backup, once its keys are safely in the new one. */
export async function deleteLegacyPinBackup(): Promise<void> {
  await deleteKeyBackup();
}
