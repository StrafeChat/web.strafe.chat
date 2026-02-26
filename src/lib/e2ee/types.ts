/** E2EE session for encrypting messages to a recipient device */
export interface Session {
  recipientUserId: string;
  recipientDeviceId: number;
  /** Base64-encoded AES key derived from ECDH */
  encryptionKey: string;
  createdAt: number;
}

/** Group message payload: s = sender self-encrypt; recipients = per (user_id, device_id) ciphertext */
export interface GroupCipherPayload {
  s?: string;
  recipients?: Array<{ user_id: string; device_id: number; ciphertext: string }>;
}

/** Device identity – stored in IndexedDB, never leaves device */
export interface DeviceIdentity {
  deviceId: number;
  /** Base64 X25519 public (uploaded to server) */
  identityKeyPublic: string;
  /** Base64 X25519 private (local only) */
  identityKeyPrivate: string;
  /** Base64 X25519 public (uploaded to server) */
  signedPrekeyPublic: string;
  /** Base64 X25519 private (local only, for receiving) */
  signedPrekeyPrivate: string;
  signedPrekeyId: number;
  registrationId: number;
  createdAt: number;
}
