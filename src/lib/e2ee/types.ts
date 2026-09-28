/**
 * Legacy wire types, kept only so old message history (encrypted under the previous
 * static-key scheme) stays decryptable. New messages never produce these - see
 * constants.ts for the prefix-based format discriminator and rooms.ts for the current
 * Olm/Megolm encrypt/decrypt path. The old `Session`/`DeviceIdentity` types are gone
 * entirely: the new engine (OlmMachine) owns its own account/session state internally
 * (see machine.ts), so there's nothing app-level left to model for that.
 */

/** Legacy 1:1 PM payload: r = recipient's copy, s = sender's own copy. */
export interface LegacyDualCipherPayload {
  r?: string;
  s?: string;
}

/** Legacy group PM payload: s = sender self-encrypt; recipients = per (user_id, device_id) ciphertext. */
export interface LegacyGroupCipherPayload {
  s?: string;
  recipients?: Array<{ user_id: string; device_id: number; ciphertext: string }>;
}
