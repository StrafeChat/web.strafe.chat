import { createStore } from 'solid-js/store';
import { listRooms, type Room, type RoomParticipant } from '../api/rooms';
import { setUserPresence } from './presence';
import { setReadStateFromRoom, setReadState } from './readState';
import { onStargateEvent } from '../services/stargate/client';
import { registerRoomIdentity, registerUserIdentity } from './federationIds';

/** Feed the E2EE identity registry from a room and its participants. */
function registerIdentities(room: Room): void {
  registerRoomIdentity(room);
  for (const p of room.participants ?? []) registerUserIdentity(p);
}

export interface RoomsState {
  rooms: Room[];
  loading: boolean;
  hydrated: boolean;
}

export const [rooms, setRooms] = createStore<RoomsState>({
  rooms: [],
  loading: false,
  hydrated: false,
});

export async function loadRooms(): Promise<void> {
  setRooms({ loading: true });
  try {
    const list = await listRooms();
    for (const room of list) {
      registerIdentities(room);
      for (const p of room.participants ?? []) {
        if (p.presence?.status) {
          setUserPresence(p.id, p.presence);
        }
      }
      setReadStateFromRoom(room.id, room, { authoritative: true });
    }
    setRooms({ rooms: list, loading: false, hydrated: true });
  } catch {
    setRooms({ loading: false, hydrated: true });
  }
}

export function clearRooms() {
  setRooms({ rooms: [], loading: false, hydrated: false });
  setReadState({ byRoom: {} });
}

/** Update room's last_message_id (for real-time unread when MESSAGE_CREATE arrives). */
export function updateRoomLastMessage(roomId: string, messageId: string) {
  setRooms(
    'rooms',
    (list) => list.map((r) => (r.id === roomId ? { ...r, last_message_id: messageId } : r))
  );
}

/** Set a room's last_message_id to an exact value or clear it (null) - used when a deletion
 * moves or removes the room's newest message, so the sidebar stops showing a phantom unread. */
export function setRoomLastMessageId(roomId: string, messageId: string | null) {
  setRooms('rooms', (list) =>
    list.map((r) => (r.id === roomId ? { ...r, last_message_id: messageId ?? undefined } : r))
  );
}

/** Patch this room's own mute/notify-mode fields (PM/group PM rooms only - see
 * patchSpaceRoomNotifySettings in stores/spaces.ts for space channels). */
export function patchRoomNotifySettings(
  roomId: string,
  patch: { muted?: boolean; muted_until?: string | null; notify_mode?: number }
): void {
  setRooms('rooms', (list) =>
    list.map((r) =>
      r.id !== roomId
        ? r
        : {
            ...r,
            ...(patch.muted !== undefined ? { muted: patch.muted } : {}),
            ...(patch.muted_until !== undefined ? { muted_until: patch.muted_until ?? undefined } : {}),
            ...(patch.notify_mode !== undefined ? { notify_mode: patch.notify_mode } : {}),
          }
    )
  );
}

/** Add or update a single room (e.g. after creating a PM). Idempotent. Read state is
 * merged, never overwritten - see setReadStateFromRoom. Fields the incoming object does
 * not carry are kept from the stored room: a ROOM_UPDATE for a rename says nothing about
 * `e2ee_enabled`, and replacing the room wholesale used to drop it - after which a group
 * with E2EE off was treated as E2EE on and every send was rejected by the server. */
export function addOrUpdateRoom(room: Room): void {
  registerIdentities(room);
  for (const p of room.participants ?? []) {
    if (p.presence?.status) setUserPresence(p.id, p.presence);
  }
  setReadStateFromRoom(room.id, room);
  setRooms('rooms', (list) => {
    const idx = list.findIndex((r) => r.id === room.id);
    if (idx >= 0) return list.map((r, i) => (i === idx ? { ...r, ...room } : r));
    return [...list, room];
  });
}

/** Remove a room from the list (e.g. when user is removed from group). */
export function removeRoom(roomId: string): void {
  setRooms('rooms', (list) => list.filter((r) => r.id !== roomId));
}

/** Hydrate rooms from READY payload (avoids REST round-trip). */
export function hydrateRoomsFromReady(roomsData: unknown[]): void {
  const list = roomsData as import('../api/rooms').Room[];
  for (const room of list) {
    registerIdentities(room);
    for (const p of room.participants ?? []) {
      if (p.presence?.status) {
        setUserPresence(p.id, p.presence);
      }
    }
    setReadStateFromRoom(room.id, room, { authoritative: true });
  }
  setRooms({ rooms: list, loading: false, hydrated: true });
}

/** Sort rooms by last message (most recent first). Uses last_message_id (snowflake) for order; rooms with none go last. */
export function sortRoomsByLastMessage(roomList: Room[]): Room[] {
  return [...roomList].sort((a, b) => {
    const idA = a.last_message_id ? BigInt(a.last_message_id) : 0n;
    const idB = b.last_message_id ? BigInt(b.last_message_id) : 0n;
    if (idA > idB) return -1;
    if (idA < idB) return 1;
    return 0;
  });
}

/** Normalize ROOM_CREATE payload to Room shape (ids as strings, created_at as string). */
function roomFromPayload(payload: unknown): Room | null {
  if (!payload || typeof payload !== 'object') return null;
  const d = payload as Record<string, unknown>;
  const id = d.id != null ? String(d.id) : null;
  if (!id) return null;
  const type = typeof d.type === 'number' ? d.type : 1;
  const recipients = Array.isArray(d.recipients) ? (d.recipients as unknown[]).map((x) => String(x)) : [];
  const created_at = d.created_at instanceof Date ? d.created_at.toISOString() : typeof d.created_at === 'string' ? d.created_at : new Date().toISOString();
  const participants = Array.isArray(d.participants)
    ? (d.participants as Record<string, unknown>[]).map((p): RoomParticipant => ({
        id: String(p.id ?? ''),
        username: typeof p.username === 'string' ? p.username : '',
        display_name: typeof p.display_name === 'string' ? p.display_name : '',
        avatar: typeof p.avatar === 'string' ? p.avatar : undefined,
        banner: typeof p.banner === 'string' ? p.banner : undefined,
        bio: typeof p.bio === 'string' ? p.bio : undefined,
        about_me: typeof p.about_me === 'string' ? p.about_me : undefined,
        presence: p.presence as RoomParticipant['presence'],
        ...(typeof p.public_flags === 'number' ? { public_flags: p.public_flags } : {}),
        ...(p.bot === true ? { bot: true } : {}),
        ...(p.system === true ? { system: true } : {}),
        ...(typeof p.home_domain === 'string' ? { home_domain: p.home_domain } : {}),
        ...(p.origin_id != null ? { origin_id: String(p.origin_id) } : {}),
      }))
    : undefined;
  const fed = d.federation as { origin_domain?: unknown; origin_id?: unknown } | undefined;
  const federation =
    fed && typeof fed.origin_domain === 'string' && fed.origin_id != null
      ? { origin_domain: fed.origin_domain, origin_id: String(fed.origin_id) }
      : undefined;
  return {
    id,
    type,
    recipients,
    participants,
    ...(federation ? { federation } : {}),
    created_at,
    ...(d.space_id != null && { space_id: String(d.space_id) }),
    ...(d.parent_id != null && { parent_id: String(d.parent_id) }),
    ...(d.name != null && typeof d.name === 'string' && { name: d.name }),
    ...(d.topic != null && typeof d.topic === 'string' && { topic: d.topic }),
    ...(d.creator_id != null && d.creator_id !== '' && { creator_id: String(d.creator_id) }),
    ...(typeof d.e2ee_enabled === 'boolean' && { e2ee_enabled: d.e2ee_enabled }),
    ...(d.last_message_id != null && { last_message_id: String(d.last_message_id) }),
    ...(d.last_read_message_id != null && { last_read_message_id: String(d.last_read_message_id) }),
    ...(d.mention_count != null && typeof d.mention_count === 'number' && { mention_count: d.mention_count }),
    ...(d.updated_at != null && { updated_at: d.updated_at instanceof Date ? d.updated_at.toISOString() : String(d.updated_at) }),
  };
}

/** Register Stargate handlers for ROOM_CREATE and ROOM_UPDATE. Call once on app init. */
export function initRoomHandlers(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'ROOM_CREATE' && event.t !== 'ROOM_UPDATE') return;
    const payload = (event.d as { d?: unknown })?.d ?? event.d;
    const room = roomFromPayload(payload);
    if (room) addOrUpdateRoom(room);
  });
}

/** True if room is a notes room (self-PM, single participant). */
export function isNotesRoom(room: Room, currentUserId: string): boolean {
  return (
    room.participants?.length === 1 &&
    room.participants[0]?.id === currentUserId
  );
}

/** Display name: room name, or for groups with no name the list of other members, or for PM the other user, or "Notes" for self-PM */
export function roomDisplayName(room: Room, currentUserId: string): string {
  if (room.name && room.name.trim()) return room.name;
  if (room.participants?.length) {
    const others = room.participants.filter((p) => p.id !== currentUserId);
    if (others.length > 1) {
      return others.map((p) => p.display_name || p.username || 'Unknown').join(', ');
    }
    if (others.length === 1) {
      return others[0]!.display_name || others[0]!.username || 'Unknown';
    }
    if (room.participants.length === 1 && room.participants[0]!.id === currentUserId) {
      return 'Notes';
    }
  }
  return 'Unknown';
}
