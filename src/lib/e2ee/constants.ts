/**
 * E2EE constants – Signal Protocol (X3DH) aligned
 *
 * Reference: https://signal.org/docs/specifications/x3dh/
 *
 * Implementation status:
 * ✓ X25519 identity key + signed prekey per device
 * ✓ DH(IK_A, SPK_B) session key derivation (simplified X3DH)
 * ✓ HKDF-SHA256 for key expansion (Signal uses similar)
 * ✓ AES-256-GCM for message encryption (96-bit IV, 128-bit tag)
 * ✓ Sender identity in ciphertext header for recipient key derivation
 * ○ Ed25519 signed prekey signature (placeholder until implemented)
 * ○ One-time prekeys (table exists, not yet used)
 * ○ Double Ratchet for session evolution (future)
 */

/** Protocol version for documentation; do not change HKDF constants – breaks existing messages */
export const PROTOCOL_VERSION = 1;

/** Prefix for messages sent without E2EE when recipient has no devices */
export const PLAINTEXT_PREFIX = 'PLAINTEXT:';

/** Prefix for dual ciphertext: encrypted for both recipient and sender (cross-device). */
export const DUAL_CIPHERTEXT_PREFIX = 'DUAL:';

/** Prefix for group ciphertext: encrypted for sender (s) and each recipient (recipients[].ciphertext). */
export const GROUP_CIPHERTEXT_PREFIX = 'GROUP:';

/** HKDF salt – fixed; changing breaks all existing encrypted messages */
export const HKDF_SALT = new TextEncoder().encode('StrafeChat-E2EE-Salt');

/** HKDF info – binds derived key to protocol/usage */
export const HKDF_INFO = new TextEncoder().encode('StrafeChat-E2EE-v1');

export const X25519_KEY_LENGTH = 32;
export const IV_LENGTH = 12; // 96 bits – NIST recommendation for AES-GCM
export const TAG_LENGTH = 128; // bits – AES-GCM authentication tag
