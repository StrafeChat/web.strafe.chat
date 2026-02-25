/**
 * E2EE service – device registration, session management, encrypt/decrypt
 *
 * Signal-inspired protocol (simplified X3DH):
 * - X25519 identity + signed prekey per device
 * - Session key derived via ECDH(our identity private, their signed prekey)
 * - AES-256-GCM for message encryption
 *
 * TODO: Ed25519 signed prekey signature, one-time prekeys, Double Ratchet
 */

import * as crypto from './crypto';
import * as store from './store';
import type { DeviceIdentity, Session } from './types';
import { registerDevice, getPrekeyBundle, listDevices } from '../../api/devices';
import type { PrekeyBundle } from '../../api/devices';

const DEFAULT_DEVICE_ID = 1;

export async function ensureDevice(): Promise<DeviceIdentity> {
  let device = await store.getDeviceIdentity();
  if (device) return device;

  const [identityKeyPair, signedPrekeyPair] = await Promise.all([
    crypto.generateKeyPair(),
    crypto.generateKeyPair(),
  ]);

  const regBytes = new Uint8Array(2);
  globalThis.crypto.getRandomValues(regBytes);
  const registrationId = regBytes[0]! * 256 + regBytes[1]!;
  device = {
    deviceId: DEFAULT_DEVICE_ID,
    identityKeyPublic: identityKeyPair.publicKey,
    identityKeyPrivate: identityKeyPair.privateKey,
    signedPrekeyPublic: signedPrekeyPair.publicKey,
    signedPrekeyPrivate: signedPrekeyPair.privateKey,
    signedPrekeyId: 1,
    registrationId: registrationId % 16384,
    createdAt: Date.now(),
  };
  await store.setDeviceIdentity(device);

  // Register with backend. signed_prekey_signature: placeholder until Ed25519 signing.
  await registerDevice({
    device_id: device.deviceId,
    identity_key: device.identityKeyPublic,
    signed_prekey: device.signedPrekeyPublic,
    signed_prekey_signature: device.signedPrekeyPublic.slice(0, 64) || 'x',
    signed_prekey_id: device.signedPrekeyId,
    registration_id: device.registrationId,
    one_time_prekeys: [],
  });

  return device;
}

/** Get or create a session with a recipient device. Uses their signed prekey for DH. */
export async function getOrCreateSession(
  recipientUserId: string,
  recipientDeviceId: number
): Promise<Session> {
  let session = await store.getSession(recipientUserId, recipientDeviceId);
  if (session) return session;

  const device = await store.getDeviceIdentity();
  if (!device) throw new Error('Device not initialized');

  const bundle = await getPrekeyBundle(recipientUserId, String(recipientDeviceId));
  if (!bundle) throw new Error('No prekey bundle for recipient');

  const encryptionKey = await crypto.deriveSessionKey(
    device.identityKeyPrivate,
    bundle.signed_prekey
  );

  session = {
    recipientUserId,
    recipientDeviceId,
    encryptionKey,
    createdAt: Date.now(),
  };
  await store.setSession(session);
  return session;
}

/** Encrypt a message for a recipient. Caller must have a session (getOrCreateSession first). */
export async function encryptMessage(
  plaintext: string,
  recipientUserId: string,
  recipientDeviceId: number
): Promise<string> {
  const device = await store.getDeviceIdentity();
  const session = await store.getSession(recipientUserId, recipientDeviceId);
  if (!device || !session) throw new Error('No session with recipient');
  return crypto.encryptWithHeader(
    plaintext,
    device.identityKeyPublic,
    session.encryptionKey
  );
}

/** Decrypt a message from a sender. Uses our signed prekey to derive their session. */
export async function decryptMessage(ciphertext: string): Promise<string> {
  const device = await store.getDeviceIdentity();
  if (!device) throw new Error('Device not initialized');
  return crypto.decryptWithHeader(ciphertext, device.signedPrekeyPrivate);
}
