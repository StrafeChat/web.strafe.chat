/**
 * Media keys for end-to-end encrypted calls.
 *
 * Voice and video frames are encrypted on the sending device and decrypted on each
 * receiving device; the SFU (LiveKit) only ever forwards ciphertext, and neither it nor
 * the API can read a call. The key that makes that work is what this module moves.
 *
 * **Per-sender keys.** Every participant generates their own random media key and hands
 * it to the other participants. Nobody has to agree on a single shared secret, so there
 * is no key-owner election and no race when two people join at once: each person owns
 * exactly one key and is the only one who ever rotates it. This is the same shape Matrix's
 * Element Call uses, and LiveKit's key provider is built for it (keys are set per
 * participant identity, with a 16-slot key ring so a rotation and the key it replaces can
 * both be live for the moment it takes everyone to catch up).
 *
 * **Distribution.** A key is Olm-encrypted to each recipient *device* and sent over the
 * existing to-device channel - exactly how Megolm room keys already travel in this app.
 * The server relays ciphertext it cannot read. That also means call keys inherit the
 * properties the text E2EE already has: real per-device sessions, and the safety-number
 * UI as the out-of-band backstop against a server substituting device keys.
 *
 * **Rotation.** Callers rotate on every membership change (see stores/voice.ts), so
 * someone who leaves cannot decrypt anything sent afterwards and someone who joins
 * cannot decrypt what the SFU already forwarded. That mirrors the Megolm rotation policy
 * used for text rooms on membership change.
 */

import { OlmMachine, UserId, RequestType } from '@matrix-org/matrix-sdk-crypto-wasm';
import { toMatrixUserId, TO_DEVICE_CALL_KEY } from './constants';
import { claimKeys, sendToDevice } from '../../api/devices';
import { getMachine, getCurrentDeviceId } from './machine';
import { processOutgoingRequests, onDecryptedToDevice } from './transport';
import { b64Encode, b64Decode } from './util';

/** 32 bytes of key material; LiveKit runs HKDF over it to derive the frame key. */
export const MEDIA_KEY_BYTES = 32;
/** LiveKit's key ring size - rotation cycles through these indices. */
export const MEDIA_KEY_RING_SIZE = 16;

/** One participant's media key, identified by the LiveKit participant it belongs to. */
export interface MediaKeyAnnouncement {
  /** Strafe room id the call is in. */
  roomId: string;
  /** LiveKit participant identity ("<user id>.<session id>") this key encrypts for. */
  identity: string;
  /** Key-ring slot (0..15). */
  keyIndex: number;
  key: Uint8Array;
}

/** An announcement that arrived from a peer, with who actually sent it. */
export interface IncomingMediaKey extends MediaKeyAnnouncement {
  /** Local user id of the sending device's owner, per the Olm decryption. */
  senderUserId: string;
  senderDeviceId?: string;
  /** Whether that device has been verified out of band (safety numbers). */
  senderVerified: boolean;
}

export function generateMediaKey(): Uint8Array {
  const key = new Uint8Array(MEDIA_KEY_BYTES);
  crypto.getRandomValues(key);
  return key;
}

/** The user id half of a LiveKit participant identity. */
export function userIdOfIdentity(identity: string): string {
  const dot = identity.indexOf('.');
  return dot > 0 ? identity.slice(0, dot) : identity;
}

function txnId(): string {
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * How often to re-query the device lists of users we already track. `updateTrackedUsers`
 * only queries users it has never seen, and this app has no device-list sync stream to
 * mark them changed - so without this a participant who signed in on a *new* device
 * would never be sent the media key and could never decrypt the call. Throttled so a
 * burst of rotations costs one query rather than one each.
 */
const DEVICE_LIST_REFRESH_MS = 15_000;
let lastDeviceListRefresh = 0;

/**
 * Make sure we hold an Olm session with every device of these users, claiming one-time
 * keys where we don't. Without this, encrypting to a device we've never talked to fails.
 */
async function ensureOlmSessions(machine: OlmMachine, userIds: UserId[]): Promise<void> {
  if (Date.now() - lastDeviceListRefresh > DEVICE_LIST_REFRESH_MS) {
    lastDeviceListRefresh = Date.now();
    await machine.markAllTrackedUsersAsDirty();
  }
  await machine.updateTrackedUsers(userIds.map((u) => u.clone()));
  await processOutgoingRequests(machine);
  const claimReq = await machine.getMissingSessions(userIds.map((u) => u.clone()));
  if (!claimReq) return;
  const body = JSON.parse(claimReq.body) as { one_time_keys?: Record<string, Record<string, string>> };
  const res = await claimKeys(body.one_time_keys ?? {});
  await machine.markRequestAsSent(claimReq.id, RequestType.KeysClaim, JSON.stringify(res));
}

/**
 * Olm-encrypt this device's media key to every device of `targetUserIds` and send it.
 * Never sends to this device itself. Failing to reach one device doesn't stop the rest -
 * a participant we couldn't key simply can't decrypt us, which the UI shows rather than
 * silently dropping to plaintext.
 */
export async function sendMediaKey(
  userId: string,
  announcement: MediaKeyAnnouncement,
  targetUserIds: string[]
): Promise<void> {
  const targets = [...new Set(targetUserIds.filter(Boolean))];
  if (targets.length === 0) return;
  const machine = await getMachine(userId);
  const myDeviceId = getCurrentDeviceId();
  if (!myDeviceId) return;

  await ensureOlmSessions(
    machine,
    targets.map((u) => new UserId(toMatrixUserId(u)))
  );

  const content = {
    room_id: announcement.roomId,
    identity: announcement.identity,
    key_index: announcement.keyIndex,
    key: b64Encode(announcement.key),
  };

  const messages: Record<string, Record<string, unknown>> = {};
  for (const target of targets) {
    const federatedId = toMatrixUserId(target);
    const devices = await machine.getUserDevices(new UserId(federatedId));
    for (const device of devices.devices()) {
      const deviceId = device.deviceId.toString();
      // Our own device already has the key in memory; encrypting to ourselves would
      // fail anyway (no self Olm session).
      if (target === userId && deviceId === myDeviceId) continue;
      try {
        const encrypted = await device.encryptToDeviceEvent(TO_DEVICE_CALL_KEY, content);
        (messages[federatedId] ??= {})[deviceId] = JSON.parse(encrypted);
      } catch (err) {
        console.warn('[voice-e2ee] could not encrypt media key to device', federatedId, deviceId, err);
      }
    }
  }
  if (Object.keys(messages).length === 0) return;
  // Olm-encrypted to-device events go on the wire as m.room.encrypted, the same as
  // room keys; the inner type is what the recipient's machine surfaces after decryption.
  await sendToDevice('m.room.encrypted', txnId(), myDeviceId, messages);
}

/**
 * Subscribe to media keys arriving from peers. The sender identity is taken from the
 * Olm decryption, never from the payload, and an announcement whose claimed LiveKit
 * identity doesn't belong to the sending user is dropped - otherwise a participant could
 * claim someone else's identity and have their own key used to decrypt that person's
 * media slot.
 */
export function onIncomingMediaKey(handler: (key: IncomingMediaKey) => void): () => void {
  return onDecryptedToDevice((event) => {
    if (event.type !== TO_DEVICE_CALL_KEY) return;
    const c = event.content as Record<string, unknown>;
    const roomId = c.room_id != null ? String(c.room_id) : '';
    const identity = c.identity != null ? String(c.identity) : '';
    const keyIndex = typeof c.key_index === 'number' ? c.key_index : -1;
    const rawKey = typeof c.key === 'string' ? c.key : '';
    if (!roomId || !identity || !rawKey || keyIndex < 0 || keyIndex >= MEDIA_KEY_RING_SIZE) return;
    if (userIdOfIdentity(identity) !== event.senderUserId) {
      console.warn('[voice-e2ee] dropping media key claiming an identity its sender does not own', identity);
      return;
    }
    let key: Uint8Array;
    try {
      key = b64Decode(rawKey);
    } catch {
      return;
    }
    if (key.length !== MEDIA_KEY_BYTES) return;
    handler({
      roomId,
      identity,
      keyIndex,
      key,
      senderUserId: event.senderUserId,
      senderDeviceId: event.senderDeviceId,
      senderVerified: event.senderVerified,
    });
  });
}
