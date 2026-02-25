/**
 * E2EE crypto – Signal-inspired X25519 ECDH + HKDF + AES-256-GCM
 * Uses Web Crypto API. Keys from prekey bundle are base64 (Curve25519).
 */

import {
  IV_LENGTH,
  TAG_LENGTH,
  HKDF_SALT,
  HKDF_INFO,
  X25519_KEY_LENGTH as IDENTITY_KEY_LENGTH,
} from './constants';

function b64Decode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Generate X25519 keypair */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveBits']
  )) as CryptoKeyPair;
  const [pubRaw, privRaw] = await Promise.all([
    crypto.subtle.exportKey('raw', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);
  return {
    publicKey: b64Encode(new Uint8Array(pubRaw)),
    privateKey: b64Encode(new Uint8Array(privRaw)),
  };
}

/** Import raw X25519 public key from base64 */
async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = b64Decode(b64);
  const buf = new Uint8Array(raw).buffer as ArrayBuffer;
  return crypto.subtle.importKey(
    'raw',
    buf,
    { name: 'X25519' },
    false,
    []
  );
}

/** Import PKCS8 X25519 private key from base64 */
async function importPrivateKey(b64: string): Promise<CryptoKey> {
  const raw = b64Decode(b64);
  const buf = new Uint8Array(raw).buffer as ArrayBuffer;
  return crypto.subtle.importKey(
    'pkcs8',
    buf,
    { name: 'X25519' },
    false,
    ['deriveBits']
  );
}

/** Derive AES key from ECDH shared secret */
async function deriveAesKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: HKDF_SALT,
      info: HKDF_INFO,
    },
    keyMaterial,
    256
  );
  return crypto.subtle.importKey(
    'raw',
    bits,
    { name: 'AES-GCM' },
    true, // extractable so we can export and store the session key
    ['encrypt', 'decrypt']
  );
}

/** Perform ECDH and derive AES session key. Uses our private + their public. */
export async function deriveSessionKey(
  ourPrivateKeyB64: string,
  theirPublicKeyB64: string
): Promise<string> {
  const [ourPriv, theirPub] = await Promise.all([
    importPrivateKey(ourPrivateKeyB64),
    importPublicKey(theirPublicKeyB64),
  ]);
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: theirPub },
    ourPriv,
    256
  );
  const aesKey = await deriveAesKey(sharedBits);
  const raw = await crypto.subtle.exportKey('raw', aesKey);
  return b64Encode(new Uint8Array(raw));
}

/** Encrypt plaintext. Returns base64(iv || ciphertext_with_tag). */
export async function encrypt(plaintext: string, keyB64: string): Promise<string> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return b64Encode(combined);
}

/** Decrypt ciphertext. Input: base64(iv:ciphertext:tag). */
export async function decrypt(ciphertextB64: string, keyB64: string): Promise<string> {
  const key = await importAesKey(keyB64);
  const combined = b64Decode(ciphertextB64);
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    data
  );
  return new TextDecoder().decode(plaintext);
}

async function importAesKey(b64: string): Promise<CryptoKey> {
  const raw = b64Decode(b64);
  const buf = new Uint8Array(raw).buffer as ArrayBuffer;
  return crypto.subtle.importKey(
    'raw',
    buf,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt for recipient. Prepends sender identity public (32 bytes) so recipient can derive key.
 * Format: sender_identity_public || iv || aes_gcm(plaintext)
 */
export async function encryptWithHeader(
  plaintext: string,
  senderIdentityPublicB64: string,
  sessionKeyB64: string
): Promise<string> {
  const key = await importAesKey(sessionKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const senderIdentity = b64Decode(senderIdentityPublicB64);
  if (senderIdentity.length !== IDENTITY_KEY_LENGTH) throw new Error('Invalid identity key length');
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    encoded
  );
  const combined = new Uint8Array(
    IDENTITY_KEY_LENGTH + IV_LENGTH + ciphertext.byteLength
  );
  combined.set(senderIdentity, 0);
  combined.set(iv, IDENTITY_KEY_LENGTH);
  combined.set(new Uint8Array(ciphertext), IDENTITY_KEY_LENGTH + IV_LENGTH);
  return b64Encode(combined);
}

/**
 * Decrypt from sender. Extracts sender identity from header, derives key using our signed prekey.
 */
export async function decryptWithHeader(
  ciphertextB64: string,
  ourSignedPrekeyPrivateB64: string
): Promise<string> {
  const combined = b64Decode(ciphertextB64);
  if (combined.length < IDENTITY_KEY_LENGTH + IV_LENGTH) {
    throw new Error('Ciphertext too short');
  }
  const senderIdentityB64 = b64Encode(combined.slice(0, IDENTITY_KEY_LENGTH));
  const iv = combined.slice(IDENTITY_KEY_LENGTH, IDENTITY_KEY_LENGTH + IV_LENGTH);
  const encrypted = combined.slice(IDENTITY_KEY_LENGTH + IV_LENGTH);

  const keyB64 = await deriveSessionKey(ourSignedPrekeyPrivateB64, senderIdentityB64);
  const key = await importAesKey(keyB64);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    encrypted
  );
  return new TextDecoder().decode(plaintext);
}
