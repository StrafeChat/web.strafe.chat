import { createStore } from 'solid-js/store';
import { handleIncomingToDevice, rotateRoomSession, scheduleBackupSync } from '../lib/e2ee';
import { getCurrentDeviceId } from '../lib/e2ee/machine';
import { auth } from './auth';
import { rooms } from './rooms';
import { spaces } from './spaces';
import { retryPendingDecrypts } from './messages';
import { onStargateEvent } from '../services/stargate/client';

const ROOM_TYPE_SPACE_TEXT = 3;

export interface E2EESyncState {
  /** Set when the server reports that *this* session's own device was revoked (e.g. from
   * device-management UI on another session) - a future banner/UI can watch this and
   * prompt the user to sign back in rather than silently failing every send/decrypt. */
  thisDeviceRevoked: boolean;
}

export const [e2eeSync, setE2eeSync] = createStore<E2EESyncState>({
  thisDeviceRevoked: false,
});

/** Register handlers for the three gateway events the E2EE engine needs live, on top of
 * the initial poll-on-load ensureDevice already does. Call once on app init. */
export function initE2EESyncHandlers() {
  return onStargateEvent((evt) => {
    if (evt.t === 'TO_DEVICE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as {
        id?: string | number;
        type?: string;
        sender_user_id?: string | number;
        sender_device_id?: string | number;
        sender_fid?: string;
        content?: unknown;
      };
      const currentUserId = auth.user?.id;
      if (!currentUserId || data.id == null || !data.type) return;
      handleIncomingToDevice(currentUserId, {
        id: String(data.id),
        type: data.type,
        sender_user_id: String(data.sender_user_id ?? ''),
        sender_device_id: String(data.sender_device_id ?? ''),
        // Federated senders are identified by their home instance's naming; the local
        // sender_user_id is only this instance's shadow of them.
        sender_fid: typeof data.sender_fid === 'string' ? data.sender_fid : undefined,
        content: data.content,
      })
        .then(() => {
          // This may have been the room key some already-received message was waiting on.
          void retryPendingDecrypts();
          // ...and a key this device now holds should reach the backup, so a future device
          // can read the same history rather than only what arrives after it exists.
          scheduleBackupSync();
        })
        .catch((e) => console.error('[e2ee] failed to process incoming to-device message', e));
    } else if (evt.t === 'SESSION_ROTATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as { room_id?: string | number; space_id?: string | number };
      const currentUserId = auth.user?.id;
      if (!currentUserId) return;
      if (data.room_id != null) {
        rotateRoomSession(currentUserId, String(data.room_id)).catch((e) =>
          console.error('[e2ee] session rotate failed', e)
        );
      } else if (data.space_id != null) {
        // Space-wide signal (membership changed somewhere in the space): the server
        // doesn't enumerate which channels have E2EE on, so each client rotates its own
        // E2EE-enabled text channels for that space - see spaces.Service.publishMemberRemoved.
        // The spaces store holds every room in the space; the rooms store only has the
        // ones this session has actually opened, so check both.
        const spaceId = String(data.space_id);
        const toRotate = new Set<string>();
        for (const r of spaces.spaceRoomsBySpaceId[spaceId] ?? []) {
          if (r.type === ROOM_TYPE_SPACE_TEXT && r.e2ee_enabled === true) toRotate.add(r.id);
        }
        for (const r of rooms.rooms) {
          if (r.space_id === spaceId && r.type === ROOM_TYPE_SPACE_TEXT && r.e2ee_enabled === true) toRotate.add(r.id);
        }
        for (const id of toRotate) {
          rotateRoomSession(currentUserId, id).catch((e) =>
            console.error('[e2ee] session rotate failed for space room', id, e)
          );
        }
      }
    } else if (evt.t === 'DEVICE_REVOKED') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as { user_id?: string | number; device_id?: string | number };
      if (data.device_id == null) return;
      if (String(data.device_id) === getCurrentDeviceId()) {
        console.warn('[e2ee] this device was revoked; sends/decrypts will fail until re-authenticated');
        setE2eeSync('thisDeviceRevoked', true);
      }
      // A *different* device being revoked needs no local action: the server no longer
      // returns its keys from queryKeys, so the next ensureRoomKeyShared naturally stops
      // sharing with it - nothing cached here should keep including it.
    }
  });
}
