import {
  OlmMachine,
  RoomId,
  UserId,
  EncryptionSettings,
  EncryptionAlgorithm,
  CollectStrategy,
  DecryptionSettings,
  TrustRequirement,
  RequestType,
} from '@matrix-org/matrix-sdk-crypto-wasm';
import { toMatrixRoomId, toMatrixUserId, CHAT_EVENT_TYPE, MEGOLM_CIPHERTEXT_PREFIX } from './constants';
import { claimKeys, sendToDevice } from '../../api/devices';
import { getCurrentDeviceId } from './machine';
import { processOutgoingRequests } from './transport';

function encryptionSettings(): EncryptionSettings {
  const s = new EncryptionSettings();
  s.algorithm = EncryptionAlgorithm.MegolmV1AesSha2;
  s.sharingStrategy = CollectStrategy.allDevices();
  return s;
}

/**
 * Ensure the local Megolm outbound session for a room is shared with every current
 * member before encrypting. Cheap to call on every send: getMissingSessions/
 * shareRoomKey are no-ops once a session already covers the current member set, per the
 * OlmMachine's own design (only membership *changes* or a fresh room make this do real
 * work). Applies to 1:1 PMs too - a PM is modeled as a 2-member room, giving it the same
 * forward-secrecy properties as any group; see the README note on why this is a better
 * fit than a separate raw-Olm-per-message transport for actual chat content.
 */
/**
 * How often to re-query every tracked user's device list. updateTrackedUsers only queries
 * users it hasn't seen before; already-tracked users are re-queried when a sync marks
 * them "changed", and this app has no device-list sync stream to do that. Without a
 * periodic refresh a member's *new* device (new browser, restored from backup, second
 * machine) would never be discovered, so room keys would never be shared with it and it
 * could never read anything. Throttled so a burst of sends costs one extra request, not one
 * per message.
 */
const DEVICE_LIST_REFRESH_MS = 30_000;
let lastDeviceListRefresh = 0;

export async function ensureRoomKeyShared(machine: OlmMachine, roomId: string, memberUserIds: string[]): Promise<void> {
  const matrixRoomId = new RoomId(toMatrixRoomId(roomId));
  const matrixUserIds = memberUserIds.map((u) => new UserId(toMatrixUserId(u)));

  // Make sure we're tracking these users' device lists before asking for sessions -
  // this app has no continuous /sync device-list diffing, so we refresh at the point of
  // use instead of relying on passive change notifications.
  if (Date.now() - lastDeviceListRefresh > DEVICE_LIST_REFRESH_MS) {
    lastDeviceListRefresh = Date.now();
    await machine.markAllTrackedUsersAsDirty();
  }
  await machine.updateTrackedUsers(matrixUserIds.map((u) => u.clone()));
  await processOutgoingRequests(machine);

  const claimReq = await machine.getMissingSessions(matrixUserIds.map((u) => u.clone()));
  if (claimReq) {
    const body = JSON.parse(claimReq.body);
    const res = await claimKeys(body.one_time_keys ?? {});
    await machine.markRequestAsSent(claimReq.id, RequestType.KeysClaim, JSON.stringify(res));
  }

  const toDeviceReqs = await machine.shareRoomKey(matrixRoomId, matrixUserIds, encryptionSettings());
  const deviceId = getCurrentDeviceId();
  for (const req of toDeviceReqs) {
    const body = JSON.parse(req.body);
    if (deviceId) {
      await sendToDevice(req.event_type, req.txn_id, deviceId, body.messages ?? {});
    }
    await machine.markRequestAsSent(req.id, RequestType.ToDevice, JSON.stringify({}));
  }
}

/** Encrypt plaintext for a room via Megolm. Caller must have called
 * ensureRoomKeyShared for the current member list first. `extra` rides along inside the
 * encrypted content next to `body` - attachment metadata and keys, for instance. */
export async function encryptForRoom(
  machine: OlmMachine,
  roomId: string,
  plaintext: string,
  extra?: Record<string, unknown>
): Promise<string> {
  const matrixRoomId = new RoomId(toMatrixRoomId(roomId));
  const encrypted = await machine.encryptRoomEvent(matrixRoomId, CHAT_EVENT_TYPE, JSON.stringify({ ...(extra ?? {}), body: plaintext }));
  return MEGOLM_CIPHERTEXT_PREFIX + encrypted;
}

/**
 * Discard the current outbound Megolm session for a room, so the next
 * ensureRoomKeyShared+encrypt creates and distributes a fresh one to only the room's
 * *current* members. Call on a SESSION_ROTATE signal (a membership change) - Megolm
 * doesn't cryptographically revoke a departed member's access to a session already
 * shared with them, so forcing a fresh session is what actually removes their access to
 * messages sent from this point on.
 */
export async function invalidateRoomSession(machine: OlmMachine, roomId: string): Promise<void> {
  const matrixRoomId = new RoomId(toMatrixRoomId(roomId));
  await machine.invalidateGroupSession(matrixRoomId);
}

export interface DecryptResult {
  plaintext: string;
  senderVerified: boolean;
  /** The full decrypted content object (body plus anything encryptForRoom's `extra` added). */
  content: Record<string, unknown>;
}

export interface RoomEventMeta {
  senderId: string;
  eventId: string;
  /** Message creation time as an ISO 8601 string (our own created_at column). */
  createdAt: string;
}

/** Decrypt a MEGOLM1: message. Throws if we don't have the session key yet (e.g. the
 * to-device room-key message hasn't arrived/been processed) - callers should catch and
 * show a "waiting for keys" placeholder rather than crashing the message list.
 *
 * decryptRoomEvent takes a *full* Matrix event (sender/event_id/origin_server_ts/room_id
 * wrapping the content encryptRoomEvent produced), not just the encrypted content on its
 * own - matching how a real Matrix client reconstructs the event it received over
 * /sync before decrypting it. We don't have a real /sync, so this rebuilds an equivalent
 * envelope from our own message row instead. */
export async function decryptForRoom(machine: OlmMachine, roomId: string, ciphertext: string, meta: RoomEventMeta): Promise<DecryptResult> {
  const matrixRoomId = new RoomId(toMatrixRoomId(roomId));
  const settings = new DecryptionSettings(TrustRequirement.Untrusted);
  const event = JSON.stringify({
    event_id: `$${meta.eventId}:strafe.internal`,
    sender: toMatrixUserId(meta.senderId),
    origin_server_ts: new Date(meta.createdAt).getTime(),
    room_id: toMatrixRoomId(roomId),
    type: 'm.room.encrypted',
    content: JSON.parse(ciphertext),
  });
  const result = await machine.decryptRoomEvent(event, matrixRoomId, settings);
  const clearEvent = JSON.parse(result.event) as { content?: Record<string, unknown>; body?: string };
  const content = clearEvent.content ?? {};
  const body = typeof content.body === 'string' ? content.body : clearEvent.body ?? '';
  return {
    plaintext: body,
    senderVerified: false, // safety-number verification is manual (see safety.ts), not surfaced per-message here
    content,
  };
}
