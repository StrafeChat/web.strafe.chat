/**
 * Per-room notification settings: effective notify-mode resolution, mute state, and the
 * actions that change them (optimistic local patch + API call + realtime cross-device
 * sync via ROOM_NOTIFY_SETTINGS_UPDATE, the same pattern MESSAGE_ACK already uses for
 * read state).
 */

import { setRoomNotifySettings as setRoomNotifySettingsApi } from '../api/rooms';
import { patchRoomNotifySettings } from '../stores/rooms';
import { patchSpaceRoomNotifySettings } from '../stores/spaces';
import { notificationPrefs } from '../stores/notificationPrefs';
import { onStargateEvent } from '../services/stargate/client';
import { stargateEventInnerRecord } from '../stores/spaceSync';

/** Mirrors equinox/internal/modules/rooms/model.go NotifyMode constants. */
export const NotifyModeDefault = 0;
export const NotifyModeAll = 1;
export const NotifyModeMentions = 2;
export const NotifyModeNone = 3;

export interface RoomLike {
  id: string;
  type: number;
  muted?: boolean;
  muted_until?: string;
  notify_mode?: number;
}

const ROOM_TYPE_SPACE_TEXT = 3;

/** True if the room is currently muted - indefinitely, or under a timed mute that hasn't
 * expired yet. A timed mute past its expiry reads as unmuted with no cleanup needed. */
export function isRoomMuted(room: RoomLike | null | undefined): boolean {
  if (!room) return false;
  if (room.muted) return true;
  if (!room.muted_until) return false;
  return new Date(room.muted_until).getTime() > Date.now();
}

/** Resolves a room's notify_mode override (0 = inherit) against the user's global
 * per-room-type default, so callers never have to special-case "default" themselves. */
export function effectiveNotifyMode(room: RoomLike | null | undefined): 'all' | 'mentions' | 'none' {
  const mode = room?.notify_mode ?? NotifyModeDefault;
  if (mode === NotifyModeAll) return 'all';
  if (mode === NotifyModeMentions) return 'mentions';
  if (mode === NotifyModeNone) return 'none';
  if (room?.type === ROOM_TYPE_SPACE_TEXT) return notificationPrefs.spaceMode;
  return notificationPrefs.pmMode;
}

function patchBothStores(roomId: string, patch: { muted?: boolean; muted_until?: string | null; notify_mode?: number }): void {
  patchRoomNotifySettings(roomId, patch);
  patchSpaceRoomNotifySettings(roomId, patch);
}

export async function setRoomNotifyMode(roomId: string, mode: number): Promise<void> {
  patchBothStores(roomId, { notify_mode: mode });
  await setRoomNotifySettingsApi(roomId, { notify_mode: mode });
}

/** Mutes a room. `durationMs === null` mutes indefinitely ("until I turn it back on"). */
export async function muteRoom(roomId: string, durationMs: number | null): Promise<void> {
  const mutedUntil = durationMs != null ? new Date(Date.now() + durationMs).toISOString() : null;
  patchBothStores(roomId, { muted: durationMs == null, muted_until: mutedUntil });
  await setRoomNotifySettingsApi(roomId, { muted: durationMs == null, muted_until: mutedUntil });
}

export async function unmuteRoom(roomId: string): Promise<void> {
  patchBothStores(roomId, { muted: false, muted_until: null });
  await setRoomNotifySettingsApi(roomId, { muted: false, muted_until: null });
}

/** Keeps mute/notify settings in sync across this user's other sessions/devices. */
export function initRoomNotifySettingsHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'ROOM_NOTIFY_SETTINGS_UPDATE') return;
    const d = stargateEventInnerRecord(event);
    if (!d) return;
    const roomId = d.room_id != null ? String(d.room_id) : null;
    if (!roomId) return;
    patchBothStores(roomId, {
      muted: d.muted === true,
      muted_until: typeof d.muted_until === 'string' ? d.muted_until : null,
      notify_mode: typeof d.notify_mode === 'number' ? d.notify_mode : NotifyModeDefault,
    });
  });
}
