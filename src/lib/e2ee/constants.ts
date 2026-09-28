// Wire-format prefixes for message.ciphertext, discriminating which scheme encrypted a
// given message. New prefixes for the real Olm/Megolm engine; the old ones stay as
// read-only legacy support so existing history stays readable (see stores/messages.ts) -
// there's no way to re-encrypt old messages into the new format (that needs the old
// scheme's session key, which by design a real ratchet doesn't let you reconstruct).
import { localUserIdFor, roomFederatedId, userFederatedId } from '../../stores/federationIds';

export const PLAINTEXT_PREFIX = 'PLAIN:';
export const LEGACY_DUAL_CIPHERTEXT_PREFIX = 'DUAL:';
export const LEGACY_GROUP_CIPHERTEXT_PREFIX = 'GROUP:';
export const OLM_CIPHERTEXT_PREFIX = 'OLM1:';
export const MEGOLM_CIPHERTEXT_PREFIX = 'MEGOLM1:';

// The crypto engine needs Matrix-shaped identifiers (@user:server, !room:server). Before
// federation these used a synthetic server name; with federation on, users are named by
// their *home* instance (@origin_id:home_domain) and rooms by the instance that created
// them, so every participating instance agrees on the same strings - which is what lets
// Olm sessions and Megolm room keys work across instances. stores/federationIds.ts
// holds the local-id → federated-id mapping; these are thin wrappers over it.
export function toMatrixUserId(userId: string): string {
  return userFederatedId(userId);
}

export function fromMatrixUserId(matrixUserId: string): string {
  return localUserIdFor(matrixUserId);
}

export function toMatrixRoomId(roomId: string): string {
  return roomFederatedId(roomId);
}

export function fromMatrixRoomId(matrixRoomId: string): string {
  const m = /^!([^:]+):/.exec(matrixRoomId);
  return m ? m[1]! : matrixRoomId;
}

// Event type used for our own message content inside encryptRoomEvent/decryptRoomEvent -
// arbitrary string we control, analogous to Matrix's "m.room.message".
export const CHAT_EVENT_TYPE = 'chat.strafe.message';

// To-device event types.
export const TO_DEVICE_ROOM_KEY_REQUEST = 'chat.strafe.room_key_request';
export const TO_DEVICE_REVOCATION = 'chat.strafe.device_revoked';
// A participant's media key for an end-to-end encrypted call. Olm-encrypted to each
// peer device like a room key, so the server (and the SFU carrying the media) never
// sees it - see lib/e2ee/callKeys.ts.
export const TO_DEVICE_CALL_KEY = 'chat.strafe.call_key';
