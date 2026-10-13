import type { Room } from '../api/rooms';
import type { SpaceRoom } from '../api/spaces';
import { rooms } from './rooms';
import { spaces } from './spaces';

/**
 * A space's channels and threads live in the spaces store, but sending and editing work on
 * the rooms store's `Room`, so the page showing a space room mirrors it into the rooms store.
 * That mirror is not something the send path can count on - the server lists a space room in
 * READY / GET /rooms only once this account has read or written there, and the page mirrors
 * only when the room it shows changes - so the send path resolves rooms through here, falling
 * back to the spaces store's copy. Kept apart from both stores because the spaces store
 * already imports the rooms store.
 */

/** A space room in the rooms store's shape. */
export function spaceRoomToRoom(r: SpaceRoom, spaceId: string): Room {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    topic: r.topic,
    position: r.position,
    space_id: spaceId,
    parent_id: r.parent_id,
    last_message_id: r.last_message_id,
    last_read_message_id: r.last_read_message_id,
    mention_count: r.mention_count,
    // The send path decides between plaintext and Megolm from this - dropping it would send
    // an E2EE room's messages as plaintext, which the server rejects.
    e2ee_enabled: r.e2ee_enabled,
    ...(r.federation ? { federation: r.federation } : {}),
    created_at: r.created_at,
    updated_at: r.updated_at,
    recipients: [],
    participants: [],
  };
}

/** The space room and its space, from the spaces store. */
function findSpaceRoom(roomId: string): { room: SpaceRoom; spaceId: string } | undefined {
  for (const [spaceId, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    const room = list.find((r) => r.id === roomId);
    if (room) return { room, spaceId };
  }
  return undefined;
}

/** The space a room belongs to, from whichever store knows it (undefined for a PM). */
export function spaceIdOfRoom(roomId: string): string | undefined {
  return rooms.rooms.find((r) => r.id === roomId)?.space_id ?? findSpaceRoom(roomId)?.spaceId;
}

/** The room to send to or edit in: the rooms store's copy, or for a space room missing
 * from it, one built from the spaces store. Undefined when neither store knows the room.
 *
 * A space room's E2EE flag always comes from the spaces store. READY and GET /rooms report a
 * space room whose flag was never set (rooms made before it was always written, and threads
 * under them) as encrypted, while the server's send path, like the spaces store, takes it as
 * plaintext - so the rooms store's copy sent Megolm to a plaintext room: text was refused, and
 * files were stored without the keys that open them. */
export function resolveMessageRoom(roomId: string): Room | undefined {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const found = findSpaceRoom(roomId);
  if (room) {
    if (!found || (found.room.e2ee_enabled === true) === (room.e2ee_enabled === true)) return room;
    return { ...room, e2ee_enabled: found.room.e2ee_enabled === true };
  }
  return found ? spaceRoomToRoom(found.room, found.spaceId) : undefined;
}
