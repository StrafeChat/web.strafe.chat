/**
 * Links to a room, or to one message in it, that the app opens itself instead of a new tab.
 *
 * The app's own addresses are `/spaces/<space>/rooms/<room>` and `/rooms/<room>` (a PM or a
 * group), each optionally followed by `/<message>` (Discord's message link). A link counts
 * as ours when it is on this instance: the page's own origin, or the web origin its links are
 * shared under (`publicWebOrigin`, which is the instance's address inside the desktop app,
 * whose page is tauri://localhost). A link to another instance counts only when it names a
 * room this instance mirrors: a federated space's channels keep the origin's message ids on
 * every mirror, so `https://<origin>/spaces/<s>/rooms/<r>/<m>` maps to our copy of `r`
 * exactly. Anything else stays an ordinary link.
 *
 * Pure lookups and the resolution live here, shared with the mobile app; the web's
 * navigation (router, notices, the click interceptor) is lib/openRoomLink.ts.
 */
import { publicWebOrigin } from './runtimeConfig';
import { canViewSpaceRoom } from './spaceRoomsNav';
import { auth } from '../stores/auth';
import { spaces, ensureSpaceRooms, upsertSpaceRoomFromPayload } from '../stores/spaces';
import { rooms, addOrUpdateRoom, isNotesRoom, roomDisplayName } from '../stores/rooms';
import { getRoom } from '../api/rooms';
import { getThread } from '../api/threads';
import type { SpaceRoom } from '../api/spaces';

const ROOM_TYPE_PM = 1;
const ROOM_TYPE_GROUP = 2;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;
const ROOM_TYPE_THREAD = 6;

/** A link that names a room (and maybe a message) this client can try to open. */
export interface RoomLink {
  roomId: string;
  /** The link's space, in this instance's ids; null for a `/rooms/<id>` link. */
  spaceId: string | null;
  messageId: string | null;
}

/** Where a room link leads, once the room is known to be one this account can open. */
export interface RoomLinkTarget {
  roomId: string;
  /** Null for a PM or a group. */
  spaceId: string | null;
  /** Null when the link has none, or the room has no messages to jump to (voice). */
  messageId: string | null;
  /** The room's type (1 PM, 2 group, 3 text, 4 voice, 6 thread). */
  type: number;
  /** As the room list shows it. */
  name: string;
  /** Notes (the self-PM). */
  notes: boolean;
}

const ID = '(\\d{1,20})';
const ROOM_PATH = new RegExp(`^/(?:spaces/${ID}/)?rooms/${ID}(?:/${ID})?/?$`);

/** The room, space and message of an in-app path (`/spaces/<s>/rooms/<r>[/<m>]`,
 * `/rooms/<r>[/<m>]`), whatever host it came with; null for any other path. */
export function parseRoomLinkPath(pathname: string): RoomLink | null {
  const m = ROOM_PATH.exec(pathname);
  if (!m) return null;
  return { roomId: m[2]!, spaceId: m[1] ?? null, messageId: m[3] ?? null };
}

/** The in-app path of a room, or of a message in it. */
export function roomLinkPath(roomId: string, spaceId: string | null, messageId?: string | null): string {
  const base = spaceId ? `/spaces/${spaceId}/rooms/${roomId}` : `/rooms/${roomId}`;
  return messageId ? `${base}/${messageId}` : base;
}

/** The space a room belongs to, when this client holds it. */
export function spaceIdOfRoomInStore(roomId: string): string | null {
  for (const [sid, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    if (list?.some((r) => r.id === roomId)) return sid;
  }
  const r = rooms.rooms.find((x) => x.id === roomId);
  return r?.space_id ?? null;
}

/**
 * The link people share for a message: this instance's address, except in a space hosted on
 * another instance, where it is the origin's (`https://<origin>/spaces/<s>/rooms/<r>/<m>`,
 * every id the origin's own). Message ids in a federated space's channels are the origin's on
 * every instance, so that one link opens the message for any member - from the origin, from
 * this mirror (roomLinkFromUrl maps it back) or from any other mirror - where a link with this
 * instance's ids would work only for people with an account here.
 */
export function messageLinkUrl(roomId: string, messageId: string, spaceId?: string | null): string {
  const sid = spaceId ?? spaceIdOfRoomInStore(roomId);
  if (sid) {
    const space = spaces.spaces.find((s) => s.id === sid);
    const room = spaces.spaceRoomsBySpaceId[sid]?.find((r) => r.id === roomId);
    const sf = space?.federation;
    const rf = room?.federation;
    if (sf?.origin_domain && sf.origin_id && rf?.origin_id && rf.origin_domain === sf.origin_domain && isDomain(sf.origin_domain)) {
      return `https://${sf.origin_domain}${roomLinkPath(rf.origin_id, sf.origin_id, messageId)}`;
    }
  }
  return `${publicWebOrigin()}${roomLinkPath(roomId, sid, messageId)}`;
}

function isDomain(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(s);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/** The page's location, where there is one (the app shims it; a bare test runner may not). */
function pageLocation(): Location | undefined {
  return typeof window !== 'undefined' ? window.location : undefined;
}

/** The page's own origin (compared by parts: tauri://localhost has a "null" origin in some
 * parsers), or the instance address its shared links are built on. */
function isThisInstance(u: URL): boolean {
  const loc = pageLocation();
  if (loc?.host && u.protocol === loc.protocol && u.host === loc.host) return true;
  if (!loc || (u.protocol !== 'http:' && u.protocol !== 'https:')) return false;
  const pub = hostOf(publicWebOrigin());
  return !!pub && u.host.toLowerCase() === pub.toLowerCase();
}

/**
 * Our copy of a room on another instance: a space room whose origin is the link's host and
 * whose origin id is the link's room. Null when there is none, or more than one (never guess).
 */
function mirroredRoom(u: URL, originRoomId: string): { roomId: string; spaceId: string } | null {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.host.toLowerCase();
  const hostname = u.hostname.toLowerCase();
  let found: { roomId: string; spaceId: string } | null = null;
  for (const [sid, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    for (const r of list ?? []) {
      const f = r.federation;
      if (!f || f.origin_id !== originRoomId) continue;
      const d = f.origin_domain.toLowerCase();
      if (d !== host && d !== hostname) continue;
      if (found && found.roomId !== r.id) return null;
      found = { roomId: r.id, spaceId: sid };
    }
  }
  return found;
}

/**
 * The room (and message) a link names, when it is one the app opens itself: a room or
 * message address on this instance, or on another instance for a room mirrored here. Null
 * for anything else, which stays an ordinary link. Says nothing about whether the room
 * exists or may be seen - resolveRoomLink does.
 */
export function roomLinkFromUrl(href: string): RoomLink | null {
  const raw = href.trim();
  if (!raw) return null;
  let u: URL;
  try {
    const base = pageLocation()?.href;
    u = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  const path = parseRoomLinkPath(u.pathname);
  if (!path) return null;
  if (isThisInstance(u)) return path;
  const mirror = mirroredRoom(u, path.roomId);
  return mirror ? { roomId: mirror.roomId, spaceId: mirror.spaceId, messageId: path.messageId } : null;
}

function spaceTarget(room: SpaceRoom, spaceId: string, link: RoomLink): RoomLinkTarget | null {
  if (room.type === ROOM_TYPE_SECTION) return null;
  // A thread is seen through its parent channel; everything else by its own rule.
  const all = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
  const judged = room.type === ROOM_TYPE_THREAD && room.parent_id ? all.find((r) => r.id === room.parent_id) : room;
  if (judged && !canViewSpaceRoom(judged, spaceId)) return null;
  return {
    roomId: room.id,
    spaceId,
    messageId: room.type === ROOM_TYPE_VOICE ? null : link.messageId,
    type: room.type,
    name: room.name || '',
    notes: false,
  };
}

/**
 * Where a link leads, from what this client already holds: a room of a space we are in and
 * may see, or one of our PMs and groups. Null when the client does not hold it (which does not
 * yet mean it does not exist - resolveRoomLink asks the server) or holds it but may not see it.
 */
export function findRoomLinkTarget(link: RoomLink): RoomLinkTarget | null {
  const inSpace = (sid: string) => spaces.spaceRoomsBySpaceId[sid]?.find((r) => r.id === link.roomId);
  const memberOf = (sid: string) => spaces.spaces.some((s) => s.id === sid);
  // The link's own space first; a `/rooms/<id>` link may still name a space room.
  if (link.spaceId && memberOf(link.spaceId)) {
    const room = inSpace(link.spaceId);
    if (room) return spaceTarget(room, link.spaceId, link);
  }
  for (const [sid, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    const room = list?.find((r) => r.id === link.roomId);
    if (room && memberOf(sid)) return spaceTarget(room, sid, link);
  }
  const r = rooms.rooms.find((x) => x.id === link.roomId);
  if (r && !r.space_id && (r.type === ROOM_TYPE_PM || r.type === ROOM_TYPE_GROUP)) {
    const uid = auth.user?.id ?? '';
    return {
      roomId: r.id,
      spaceId: null,
      messageId: link.messageId,
      type: r.type,
      name: roomDisplayName(r, uid),
      notes: isNotesRoom(r, uid),
    };
  }
  return null;
}

/**
 * Where a link leads, asking the server when the client does not hold the room: an archived
 * thread (not in the live room lists) or a PM this session has not listed. Null when the room
 * does not exist or this account may not see it - the server decides, as for everything else.
 */
export async function resolveRoomLink(link: RoomLink): Promise<RoomLinkTarget | null> {
  const held = findRoomLinkTarget(link);
  if (held) return held;
  const known = (sid: string | null | undefined): sid is string => !!sid && spaces.spaces.some((s) => s.id === sid);
  // In a space's list but hidden from us (a private channel, a section): no reason to ask.
  const heldHidden = Object.entries(spaces.spaceRoomsBySpaceId).some(
    ([sid, list]) => known(sid) && !!list?.some((r) => r.id === link.roomId)
  );
  if (heldHidden) return null;
  try {
    if (known(link.spaceId)) {
      // A space whose room list has not been loaded yet holds every live room once it is.
      await ensureSpaceRooms(link.spaceId);
      const listed = findRoomLinkTarget(link);
      if (listed) return listed;
      return await threadTarget(link, link.spaceId);
    }
    const room = await getRoom(link.roomId);
    if (room.space_id) {
      if (!known(room.space_id)) return null;
      await ensureSpaceRooms(room.space_id);
      const listed = findRoomLinkTarget({ ...link, spaceId: room.space_id });
      if (listed) return listed;
      return room.type === ROOM_TYPE_THREAD ? await threadTarget(link, room.space_id) : null;
    }
    if (room.type === ROOM_TYPE_PM || room.type === ROOM_TYPE_GROUP) {
      addOrUpdateRoom(room);
      return findRoomLinkTarget({ ...link, spaceId: null });
    }
  } catch {
    // Not found, or not ours to see.
  }
  return null;
}

/** An archived thread: fetched and put in its space's list, as joining one does. */
async function threadTarget(link: RoomLink, spaceId: string): Promise<RoomLinkTarget | null> {
  const raw = await getThread(link.roomId);
  const sid = raw.space_id != null ? String(raw.space_id) : spaceId;
  if (!spaces.spaces.some((s) => s.id === sid)) return null;
  upsertSpaceRoomFromPayload(sid, raw);
  return findRoomLinkTarget({ ...link, spaceId: sid });
}
