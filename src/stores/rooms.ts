import { createStore } from 'solid-js/store';
import { listRooms, type Room, type RoomParticipant } from '../api/rooms';
import { setUserPresence } from './presence';
import { setReadStateFromRoom, setReadState } from './readState';
import { onStargateEvent } from '../services/stargate/client';
import { registerRoomIdentity, registerUserIdentity } from './federationIds';
// Read only when pruning kept space rooms, never at load: the spaces store imports this one.
import { spaces } from './spaces';
import { t } from '../i18n';

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

/** Space rooms the last READY / GET /rooms did not list but keepMirroredSpaceRooms kept. */
let keptSpaceRoomIds = new Set<string>();

/**
 * The server lists a space room here only once this account has a per-user row for it (it
 * has read or written there), so the channel SpacePage mirrors into this store for the send
 * path - a new room, a new space's default rooms before anyone posts - can be absent from
 * READY or GET /rooms. Keep those mirrored entries instead of letting a reconnect drop them.
 * PMs are not kept: the server's list is the truth for those, and a group you were removed
 * from must go.
 *
 * Whether a kept room still exists is decided once the caller is done (pruneKeptSpaceRooms):
 * READY hydrates this store before the spaces store, so right now the spaces store still
 * describes the previous connection. Done from here rather than left to each READY handler,
 * so the mobile app, which runs its own, prunes too.
 */
function keepMirroredSpaceRooms(incoming: Room[]): Room[] {
  const ids = new Set(incoming.map((r) => r.id));
  const kept = rooms.rooms.filter((r) => r.space_id && !ids.has(r.id));
  keptSpaceRoomIds = new Set(kept.map((r) => r.id));
  if (kept.length) queueMicrotask(pruneKeptSpaceRooms);
  return kept.length ? [...incoming, ...kept] : incoming;
}

/**
 * Drop the space rooms keepMirroredSpaceRooms held on to that the spaces store no longer has
 * (deleted, out of reach, or their space left while the socket was down): left behind, they
 * kept a space's unread badge lit and were re-subscribed - and refused - on every reconnect.
 * A space whose room list isn't loaded is left alone, as is everything while the spaces store
 * itself isn't (the REST fallback loads both at once).
 */
function pruneKeptSpaceRooms(): void {
  const stillExists = (r: Room): boolean => {
    if (!spaces.hydrated) return true;
    const spaceId = r.space_id;
    if (!spaceId || !spaces.spaces.some((s) => s.id === spaceId)) return false;
    const list = spaces.spaceRoomsBySpaceId[spaceId];
    return !list || list.some((x) => x.id === r.id);
  };
  const gone = new Set(rooms.rooms.filter((r) => keptSpaceRoomIds.has(r.id) && !stillExists(r)).map((r) => r.id));
  keptSpaceRoomIds = new Set();
  if (gone.size) setRooms('rooms', (list) => list.filter((r) => !gone.has(r.id)));
}

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
    setRooms({ rooms: keepMirroredSpaceRooms(list), loading: false, hydrated: true });
  } catch {
    setRooms({ loading: false, hydrated: true });
  }
}

export function clearRooms() {
  keptSpaceRoomIds = new Set();
  setRooms({ rooms: [], loading: false, hydrated: false });
  setReadState({ byRoom: {} });
}

/** Update room's last_message_id (for real-time unread when MESSAGE_CREATE arrives). */
export function updateRoomLastMessage(roomId: string, messageId: string) {
  setRoomLastMessageId(roomId, messageId);
}

/** Set a room's last_message_id to an exact value or clear it (null) - used when a deletion
 * moves or removes the room's newest message, so the sidebar stops showing a phantom unread.
 * Leaves the list alone when nothing changes: most messages arrive in space channels that
 * aren't in this list, and a fresh array per message re-runs everything that reads it. */
export function setRoomLastMessageId(roomId: string, messageId: string | null) {
  const next = messageId ?? undefined;
  setRooms('rooms', (list) =>
    list.some((r) => r.id === roomId && r.last_message_id !== next)
      ? list.map((r) => (r.id === roomId ? { ...r, last_message_id: next } : r))
      : list
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
  setRooms({ rooms: keepMirroredSpaceRooms(list), loading: false, hydrated: true });
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

/** Register Stargate handlers for ROOM_CREATE, ROOM_UPDATE and ROOM_LEAVE. Call once on app init. */
export function initRoomHandlers(): () => void {
  return onStargateEvent((event) => {
    const payload = (event.d as { d?: unknown })?.d ?? event.d;
    if (event.t === 'ROOM_LEAVE') {
      // Removed from a group PM, or left it from another device. Handled here and not only
      // by the open room's page, or a group you were looking away from stayed in the list
      // for the rest of the session - its subscription refused, its history and sends 403.
      const d = payload as { room_id?: unknown } | undefined;
      if (d?.room_id != null) removeRoom(String(d.room_id));
      return;
    }
    if (event.t !== 'ROOM_CREATE' && event.t !== 'ROOM_UPDATE') return;
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
      return others.map((p) => p.display_name || p.username || t('common.unknown')).join(', ');
    }
    if (others.length === 1) {
      return others[0]!.display_name || others[0]!.username || t('common.unknown');
    }
    if (room.participants.length === 1 && room.participants[0]!.id === currentUserId) {
      return t('nav.notes');
    }
  }
  return t('common.unknown');
}
