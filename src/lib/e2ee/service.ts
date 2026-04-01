/**
 * E2EE service – device registration, session management, encrypt/decrypt
 *
 * Signal protocol (X3DH-style) with encrypted key backup for cross-device recovery.
 * - X25519 identity + signed prekey per device
 * - Session key derived via ECDH(our identity private, their signed prekey)
 * - AES-256-GCM for message encryption
 * - Key backup encrypted with recovery PIN (Signal Secure Value Recovery style)
 */

import * as crypto from './crypto';
import * as store from './store';
import * as backup from './backup';
import type { DeviceIdentity, Session } from './types';
import {
  registerDevice,
  getPrekeyBundle,
  getKeyBackup,
  setKeyBackup,
} from '../../api/devices';
import { promptRecoveryPin, setRecoveryPin } from '../../stores/recoveryPin';
import { E2eeUnavailableError } from './subtle';

const DEFAULT_DEVICE_ID = 1;

/**
 * Serialize ensureDevice per user. Without this, StargateProvider + loadMessages + realtime
 * handlers can run ensureDevice in parallel: each sees no IndexedDB row, each calls
 * promptRecoveryPin(), and later calls overwrite recoveryPin.pending — leaving promises
 * unresolved and PIN / restore broken (common on mobile when everything loads at once).
 */
const ensureDeviceInflight = new Map<string, Promise<DeviceIdentity>>();

export async function ensureDevice(userId: string): Promise<DeviceIdentity> {
  const uid = String(userId);
  const existing = ensureDeviceInflight.get(uid);
  if (existing) return existing;

  const done = ensureDeviceOnce(uid).finally(() => {
    if (ensureDeviceInflight.get(uid) === done) {
      ensureDeviceInflight.delete(uid);
    }
  });
  ensureDeviceInflight.set(uid, done);
  return done;
}

function isPersistFailure(e: unknown): boolean {
  return e instanceof Error && e.message.includes('did not persist to IndexedDB');
}

async function ensureDeviceOnce(userId: string): Promise<DeviceIdentity> {
  try {
    return await loadOrCreateDevice(userId);
  } catch (e) {
    if (e instanceof E2eeUnavailableError) {
      setRecoveryPin('e2eeEnvironmentError', e.message);
    }
    throw e;
  }
}

async function loadOrCreateDevice(userId: string): Promise<DeviceIdentity> {
  let device = await store.getDeviceIdentity(userId);
  if (device) return device;

  // Try restore from backup (new device / new session)
  try {
    const backupRes = await getKeyBackup();
    if (backupRes.exists && backupRes.encrypted_backup && backupRes.salt) {
      const enc = backupRes.encrypted_backup;
      const salt = backupRes.salt;
      let restoreAttempt = 0;
      // Retry PIN on decrypt failure (wrong PIN) without treating it as a fatal error.
      for (;;) {
        const pin = await promptRecoveryPin('restore', {
          retainSubmitError: restoreAttempt > 0,
        });
        restoreAttempt += 1;
        try {
          device = await backup.decryptFromBackup(enc, salt, pin);
          setRecoveryPin('lastSubmitError', null);
          break;
        } catch (decErr) {
          if (decErr instanceof E2eeUnavailableError) {
            throw decErr;
          }
          console.warn('Backup decrypt failed:', decErr);
          setRecoveryPin(
            'lastSubmitError',
            'That PIN did not unlock your backup. Try again or check Caps Lock / keyboard layout.'
          );
        }
      }
      if (!device.identityKeyPublic || !device.signedPrekeyPublic) {
        const bundle = await getPrekeyBundle(userId, String(device.deviceId));
        if (bundle) {
          device.identityKeyPublic = bundle.identity_key;
          device.signedPrekeyPublic = bundle.signed_prekey;
        }
      }
      try {
        await store.setDeviceIdentity(userId, device);
      } catch (persistErr) {
        if (isPersistFailure(persistErr)) throw persistErr;
        throw persistErr;
      }
      return device;
    }
  } catch (e) {
    if (e instanceof E2eeUnavailableError) throw e;
    if (e instanceof Error && e.message.includes('cancelled')) throw e;
    if (e instanceof Error && e.message.includes('Recovery PIN required'))
      throw e;
    if (isPersistFailure(e)) {
      console.error('E2EE device keys could not be saved:', e);
      throw e;
    }
    console.warn('Backup restore failed:', e);
    throw new Error('Invalid recovery PIN. Please try again.');
  }

  // Create new device
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

  await registerDevice({
    device_id: device.deviceId,
    identity_key: device.identityKeyPublic,
    signed_prekey: device.signedPrekeyPublic,
    signed_prekey_signature: device.signedPrekeyPublic.slice(0, 64) || 'x',
    signed_prekey_id: device.signedPrekeyId,
    registration_id: device.registrationId,
    one_time_prekeys: [],
  });
  await store.setDeviceIdentity(userId, device);

  // Create backup so messages work on other devices (Signal-compliant)
  try {
    const pin = await promptRecoveryPin('create');
    const { encryptedBackup, salt } = await backup.encryptForBackup(
      device,
      pin
    );
    await setKeyBackup(encryptedBackup, salt);
  } catch (e) {
    if (e instanceof E2eeUnavailableError) throw e;
    if (e instanceof Error && e.message.includes('cancelled')) {
      // User skipped – device works but no cross-device recovery
    } else {
      console.warn('Backup create failed:', e);
    }
  }

  return device;
}

/** Get or create a session with a recipient device. Always fetches fresh prekey bundle to avoid
 * stale sessions when the recipient re-registers (cleared storage, new browser). Cached sessions
 * can cause OperationError on decrypt because sender would encrypt with old key. */
export async function getOrCreateSession(
  currentUserId: string,
  recipientUserId: string,
  recipientDeviceId: number
): Promise<Session> {
  const device = await store.getDeviceIdentity(currentUserId);
  if (!device) throw new Error('Device not initialized');

  const bundle = await getPrekeyBundle(recipientUserId, String(recipientDeviceId));
  if (!bundle) throw new Error('No prekey bundle for recipient');

  const encryptionKey = await crypto.deriveSessionKey(
    device.identityKeyPrivate,
    bundle.signed_prekey
  );

  const session: Session = {
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
  currentUserId: string,
  recipientUserId: string,
  recipientDeviceId: number
): Promise<string> {
  const device = await store.getDeviceIdentity(currentUserId);
  const session = await store.getSession(recipientUserId, recipientDeviceId);
  if (!device || !session) throw new Error('No session with recipient');
  return crypto.encryptWithHeader(
    plaintext,
    device.identityKeyPublic,
    session.encryptionKey
  );
}

/** Encrypt a message for our own device (enables decryption on other devices/sessions). */
export async function encryptMessageForSelf(
  plaintext: string,
  currentUserId: string
): Promise<string> {
  await getOrCreateSession(currentUserId, currentUserId, DEFAULT_DEVICE_ID);
  return encryptMessage(
    plaintext,
    currentUserId,
    currentUserId,
    DEFAULT_DEVICE_ID
  );
}

/** Decrypt a message from a sender. Uses our signed prekey to derive their session. */
export async function decryptMessage(ciphertext: string, currentUserId: string): Promise<string> {
  const device = await store.getDeviceIdentity(currentUserId);
  if (!device) throw new Error('Device not initialized');
  const normalized = (ciphertext ?? '').trim().replace(/\s/g, '');
  if (!normalized) throw new Error('Empty ciphertext');
  return crypto.decryptWithHeader(
    normalized,
    device.signedPrekeyPrivate,
    device.identityKeyPrivate
  );
}
