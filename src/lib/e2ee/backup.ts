/**
 * Key backup – Signal Secure Value Recovery (SVR) style
 *
 * Encrypted with recovery PIN. Server stores ciphertext only.
 * PBKDF2-SHA256 + AES-256-GCM. OWASP recommends 600k+ iterations for key derivation.
 */

import type { DeviceIdentity } from './types';
import { getSubtleCrypto } from './subtle';
import { b64Decode, b64Encode } from './util';

/** PBKDF2 iterations. Do not increase – existing backups would become unrecoverable. */
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

/** Map common Unicode digits to ASCII so mobile keyboards match desktop PBKDF2 input. */
function normalizeRecoveryPin(pin: string): string {
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

/** Derive AES key from PIN using PBKDF2. */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const normalized = normalizeRecoveryPin(pin);
  const keyMaterial = await subtle.importKey(
    'raw',
    enc.encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt.slice(0),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256
  );
  return subtle.importKey(
    'raw',
    bits,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt device keys for backup. Returns { encryptedBackup, salt } base64. */
export async function encryptForBackup(
  device: DeviceIdentity,
  pin: string
): Promise<{ encryptedBackup: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKeyFromPin(pin, salt);

  const payload = JSON.stringify({
    v: 1,
    identityKeyPrivate: device.identityKeyPrivate,
    identityKeyPublic: device.identityKeyPublic,
    signedPrekeyPrivate: device.signedPrekeyPrivate,
    signedPrekeyPublic: device.signedPrekeyPublic,
    deviceId: device.deviceId,
    signedPrekeyId: device.signedPrekeyId,
    registrationId: device.registrationId,
  });

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(payload)
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return {
    encryptedBackup: b64Encode(combined),
    salt: b64Encode(salt),
  };
}

/** Decrypt device keys from backup. */
export async function decryptFromBackup(
  encryptedBackup: string,
  salt: string,
  pin: string
): Promise<DeviceIdentity> {
  const saltBytes = b64Decode(salt);
  const key = await deriveKeyFromPin(pin, saltBytes);

  const combined = b64Decode(encryptedBackup);
  if (combined.length < IV_LENGTH) {
    throw new Error('Invalid backup: too short');
  }

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await getSubtleCrypto().decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as {
    v?: number;
    identityKeyPrivate: string;
    signedPrekeyPrivate: string;
    identityKeyPublic?: string;
    signedPrekeyPublic?: string;
    deviceId?: number;
    signedPrekeyId?: number;
    registrationId?: number;
  };

  if (
    typeof parsed.identityKeyPrivate !== 'string' ||
    typeof parsed.signedPrekeyPrivate !== 'string' ||
    !parsed.identityKeyPrivate ||
    !parsed.signedPrekeyPrivate
  ) {
    throw new Error('Invalid backup: missing or invalid keys');
  }

  return {
    deviceId: parsed.deviceId ?? 1,
    identityKeyPublic: parsed.identityKeyPublic ?? '',
    identityKeyPrivate: parsed.identityKeyPrivate,
    signedPrekeyPublic: parsed.signedPrekeyPublic ?? '',
    signedPrekeyPrivate: parsed.signedPrekeyPrivate,
    signedPrekeyId: parsed.signedPrekeyId ?? 1,
    registrationId: parsed.registrationId ?? 0,
    createdAt: Date.now(),
  };
}
