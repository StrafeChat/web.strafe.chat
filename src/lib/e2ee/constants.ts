/**
 * E2EE constants – Signal-inspired protocol (X3DH-like simplified)
 * Uses X25519 ECDH + HKDF-SHA256 + AES-256-GCM.
 * Future: Ed25519 signed prekey, one-time prekeys, Double Ratchet.
 */

/** Prefix for messages sent without E2EE when recipient has no devices */
export const PLAINTEXT_PREFIX = 'PLAINTEXT:';

export const HKDF_SALT = new TextEncoder().encode('StrafeChat-E2EE-Salt');
export const HKDF_INFO = new TextEncoder().encode('StrafeChat-E2EE-v1');

export const X25519_KEY_LENGTH = 32;
export const IV_LENGTH = 12;
export const TAG_LENGTH = 128; // bits for AES-GCM auth tag
