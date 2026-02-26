import { createStore } from 'solid-js/store';
import { listRooms, type Room, type RoomParticipant } from '../api/rooms';
import { setUserPresence } from './presence';
import { setReadStateFromRoom, setReadState } from './readState';
import { onStargateEvent } from '../services/stargate/client';

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
      for (const p of room.participants ?? []) {
        if (p.presence?.status) {
          setUserPresence(p.id, p.presence);
        }
      }
      setReadStateFromRoom(room.id, room);
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

/** Add or update a single room (e.g. after creating a PM). Idempotent. */
export function addOrUpdateRoom(room: Room): void {
  for (const p of room.participants ?? []) {
    if (p.presence?.status) setUserPresence(p.id, p.presence);
  }
  setReadStateFromRoom(room.id, room);
  setRooms('rooms', (list) => {
    const idx = list.findIndex((r) => r.id === room.id);
    if (idx >= 0) return list.map((r, i) => (i === idx ? room : r));
    return [...list, room];
  });
}

/** Hydrate rooms from READY payload (avoids REST round-trip). */
export function hydrateRoomsFromReady(roomsData: unknown[]): void {
  const list = roomsData as import('../api/rooms').Room[];
  for (const room of list) {
    for (const p of room.participants ?? []) {
      if (p.presence?.status) {
        setUserPresence(p.id, p.presence);
      }
    }
    setReadStateFromRoom(room.id, room);
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
        presence: p.presence as RoomParticipant['presence'],
      }))
    : undefined;
  return {
    id,
    type,
    recipients,
    participants,
    created_at,
    ...(d.space_id != null && { space_id: String(d.space_id) }),
    ...(d.parent_id != null && { parent_id: String(d.parent_id) }),
    ...(d.name != null && typeof d.name === 'string' && { name: d.name }),
    ...(d.topic != null && typeof d.topic === 'string' && { topic: d.topic }),
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

/** Display name for a PM: other participant's name, room name, "Notes" for self-PM, or fallback */
export function roomDisplayName(room: Room, currentUserId: string): string {
  if (room.name) return room.name;
  if (room.participants?.length) {
    const other = room.participants.find((p) => p.id !== currentUserId);
    if (other) return other.display_name || other.username || 'Unknown';
    // Self-PM (notes room): only participant is current user
    if (room.participants.length === 1 && room.participants[0].id === currentUserId) {
      return 'Notes';
    }
  }
  return 'Unknown';
}
