import type { SpaceRoom } from '../api/spaces';
import { auth } from '../stores/auth';
import { spaces, spaceRoles } from '../stores/spaces';
import { spaceMembers } from '../stores/spaceMembers';
import { lastSpaceRoom } from '../stores/lastSpaceRoom';
import { canViewSpaceChannel } from './spacePermissions';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;

function canView(room: SpaceRoom, spaceId: string): boolean {
  const all = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
  const space = spaces.spaces.find((s) => s.id === spaceId);
  const uid = auth.user?.id;
  const me = uid ? spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === uid) : undefined;
  return canViewSpaceChannel({
    room,
    allRooms: all,
    memberUserId: uid,
    ownerId: space?.owner_id,
    everyoneRoleId: space?.everyone_role_id,
    memberRoleIds: me?.roles,
    roles: spaceRoles(spaceId),
  });
}

export function orderedViewableTextRooms(spaceId: string): SpaceRoom[] {
  const all = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
  const byPosition = (a: SpaceRoom, b: SpaceRoom) => a.position - b.position;
  const sections = all.filter((r) => r.type === ROOM_TYPE_SECTION).sort(byPosition);
  const sectionIds = new Set(sections.map((s) => s.id));
  const isText = (r: SpaceRoom) => r.type === ROOM_TYPE_TEXT && canView(r, spaceId);
  const list = all.filter((r) => isText(r) && (!r.parent_id || !sectionIds.has(r.parent_id))).sort(byPosition);
  for (const section of sections) {
    if (!canView(section, spaceId)) continue;
    list.push(...all.filter((r) => r.parent_id === section.id && isText(r)).sort(byPosition));
  }
  return list;
}

export function pickLandingRoomId(spaceId: string): string | null {
  if (!spaceId) return null;
  const all = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
  const last = lastSpaceRoom.get(spaceId);
  if (last) {
    const room = all.find((r) => r.id === last);
    if (room && (room.type === ROOM_TYPE_TEXT || room.type === ROOM_TYPE_VOICE) && canView(room, spaceId)) {
      return last;
    }
  }
  const text = orderedViewableTextRooms(spaceId);
  if (text[0]) return text[0].id;
  const voice = all
    .filter((r) => r.type === ROOM_TYPE_VOICE && canView(r, spaceId))
    .sort((a, b) => a.position - b.position);
  return voice[0]?.id ?? null;
}
