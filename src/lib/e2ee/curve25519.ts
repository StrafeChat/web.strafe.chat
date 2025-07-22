// Curve25519 implementation for Signal Protocol
// This provides the correct cryptographic primitives for Signal protocol compliance

import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';

// Use browser crypto for AES operations
const crypto = window.crypto;

// Signal Protocol Constants
export const SIGNAL_PROTOCOL_VERSION = 3;
export const MAX_SKIP_MESSAGES = 1000;
export const MAX_CACHE_SIZE = 1000;

// Key lengths
export const CURVE25519_KEY_LENGTH = 32;
export const SIGNATURE_LENGTH = 64;
export const MAC_LENGTH = 32;
export const IV_LENGTH = 16;

// HKDF Info strings for Signal Protocol
export const HKDF_INFO_ROOT_KEY = new TextEncoder().encode('WhisperText');
export const HKDF_INFO_CHAIN_KEY = new TextEncoder().encode('WhisperMessageKeys');
export const HKDF_INFO_MESSAGE_KEYS = new TextEncoder().encode('WhisperMessageKeys');

// Curve25519 key pair interface
export interface Curve25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

// Generate a Curve25519 key pair
export async function generateCurve25519KeyPair(): Promise<Curve25519KeyPair> {
  // Generate random 32-byte private key
  const privateKey = randomBytes(32);
  
  // Derive public key using proper X25519 scalar multiplication
  const publicKey = x25519.getPublicKey(privateKey);
  
  const keyPair = {
    publicKey: new Uint8Array(publicKey),
    privateKey: new Uint8Array(privateKey)
  };
  
  console.log('[Curve25519] Generated key pair:', {
    publicKeyLength: keyPair.publicKey.length,
    privateKeyLength: keyPair.privateKey.length,
    publicKeyFirst4: Array.from(keyPair.publicKey.slice(0, 4)),
    privateKeyFirst4: Array.from(keyPair.privateKey.slice(0, 4))
  });
  
  return keyPair;
}

// Perform Curve25519 Diffie-Hellman
export async function curve25519DH(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
  // Perform proper X25519 Diffie-Hellman key exchange
  const sharedSecret = x25519.getSharedSecret(privateKey, publicKey);
  return new Uint8Array(sharedSecret);
}

// HKDF implementation for key derivation
export async function hkdfDerive(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // Use @noble/hashes HKDF implementation
  const derivedKey = hkdf(sha256, inputKeyMaterial, salt, info, length);
  return new Uint8Array(derivedKey);
}

// HMAC-SHA256 implementation
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // Use @noble/hashes HMAC implementation
  const signature = hmac(sha256, key, data);
  return new Uint8Array(signature);
}

// AES-256-CBC encryption
export async function aes256CbcEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    plaintext
  );
  
  return new Uint8Array(ciphertext);
}

// AES-256-CBC decryption
export async function aes256CbcDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    ciphertext
  );
  
  return new Uint8Array(plaintext);
}

// Generate random bytes
export function generateRandomBytes(length: number): Uint8Array {
  return randomBytes(length);
}

// Constant-time comparison
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  
  return result === 0;
}