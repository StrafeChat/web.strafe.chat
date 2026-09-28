/**
 * The recovery code: the one secret a user keeps, and the only thing that can read their
 * key backup.
 *
 * It is *generated*, never chosen. That is the whole point. The previous design asked for a
 * 6-digit PIN, which meant the server held a blob that anyone who stole the database could
 * open by trying a million combinations - the strongest possible KDF only makes that take
 * longer, it does not make it hard. A code carrying 128 bits of CSPRNG output removes the
 * offline-guessing attack instead of slowing it down, and it costs the user nothing extra:
 * they were never going to remember a good secret either way, so they save this one.
 *
 * Format is Crockford base32 - no I, L, O or U, so there is no 1/l or 0/O ambiguity to
 * mistype, and O/I/L are silently accepted as 0/1/1 when reading a handwritten copy back -
 * in seven dash-separated groups of four:
 *
 *     SVRC-Q9TY-7B2K-MW4H-3JPX-N5ZD-8F
 *
 * The last two characters are a checksum over the rest, so a typo is reported as a typo
 * ("check the code") instead of as a decryption failure ("wrong code"), which is the
 * difference between a user fixing one character and a user concluding they lost access.
 *
 * PBKDF2 is still used to turn the code into a wrapping key. At 128 bits of entropy that is
 * theatre - there is nothing to slow down - but it costs one second once, and it means the
 * derivation stays sound if a shorter or user-chosen code is ever offered here.
 */

import { getSubtleCrypto } from './subtle';
import { b64Decode, b64Encode } from './util';

/** Crockford base32: the digits, then the letters minus I, L, O and U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const CODE_BYTES = 16; // 128 bits
const PAYLOAD_CHARS = 26; // ceil(128 / 5)
const CHECK_CHARS = 2; // 10 bits over the payload: a typo slips through 1 time in 1024
const CODE_CHARS = PAYLOAD_CHARS + CHECK_CHARS;
const GROUP_SIZE = 4;

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

/** Big-endian base32 of `bytes`, truncated/padded to exactly `chars` characters. */
function encodeBase32(bytes: Uint8Array, chars: number): string {
  let out = '';
  let acc = 0;
  let bits = 0;
  let i = 0;
  while (out.length < chars) {
    if (bits < 5) {
      acc = (acc << 8) | (i < bytes.length ? bytes[i]! : 0);
      bits += 8;
      i++;
    }
    bits -= 5;
    out += ALPHABET[(acc >>> bits) & 31];
  }
  return out;
}

async function checksumFor(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const digest = new Uint8Array(await getSubtleCrypto().digest('SHA-256', bytes));
  return encodeBase32(digest.subarray(0, 2), CHECK_CHARS);
}

/**
 * Normalize typed or pasted input to the canonical character sequence (no dashes, upper
 * case). Anything outside the alphabet is dropped rather than rejected here, so that
 * spaces, dashes and stray punctuation from a paste are forgiven; a genuinely wrong
 * character shortens the result and fails the length check in isWellFormedRecoveryCode.
 */
export function normalizeRecoveryCode(input: string): string {
  const upper = input.normalize('NFKC').toUpperCase();
  let out = '';
  for (const ch of upper) {
    // Crockford's read-back aliases: someone copying by hand writes O for 0 and I or L for 1.
    const mapped = ch === 'O' ? '0' : ch === 'I' || ch === 'L' ? '1' : ch;
    if (ALPHABET.includes(mapped)) out += mapped;
  }
  return out;
}

/** Insert the group separators, for display. */
export function formatRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += GROUP_SIZE) {
    groups.push(normalized.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Whether this could be a real recovery code: right length, right alphabet, checksum
 * agrees. Lets the UI say "that looks mistyped" without a round trip, and keeps a typo
 * from being reported as "wrong code" - which reads to a user as "you have lost access".
 */
export async function isWellFormedRecoveryCode(input: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== CODE_CHARS) return false;
  const payload = normalized.slice(0, PAYLOAD_CHARS);
  return normalized.slice(PAYLOAD_CHARS) === (await checksumFor(payload));
}

/** How many characters a complete code has, once dashes are stripped. */
export const RECOVERY_CODE_LENGTH = CODE_CHARS;

/** A fresh recovery code, formatted for display. */
export async function generateRecoveryCode(): Promise<string> {
  const payload = encodeBase32(crypto.getRandomValues(new Uint8Array(CODE_BYTES)), PAYLOAD_CHARS);
  return formatRecoveryCode(payload + (await checksumFor(payload)));
}

async function deriveWrappingKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const material = await subtle.importKey('raw', new TextEncoder().encode(normalizeRecoveryCode(code)), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.slice(0), iterations: PBKDF2_ITERATIONS },
    material,
    256
  );
  return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Wrap the backup's private key under the recovery code. The result is what the server
 * stores: without the code it is 32 bytes of noise, and the server never sees the code.
 */
export async function wrapBackupKey(privateKeyBase64: string, code: string): Promise<{ wrapped: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveWrappingKey(code, salt);
  const ciphertext = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(privateKeyBase64)
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return { wrapped: b64Encode(combined), salt: b64Encode(salt) };
}

/** Reverse of wrapBackupKey. Throws if the code is wrong or the blob is damaged. */
export async function unwrapBackupKey(wrapped: string, salt: string, code: string): Promise<string> {
  const combined = b64Decode(wrapped);
  if (combined.length < IV_LENGTH) throw new Error('invalid wrapped backup key: too short');
  const key = await deriveWrappingKey(code, b64Decode(salt));
  const plaintext = await getSubtleCrypto().decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, IV_LENGTH), tagLength: TAG_LENGTH },
    key,
    combined.slice(IV_LENGTH)
  );
  return new TextDecoder().decode(plaintext);
}
