import type { RoomParticipant } from '../api/rooms';
import type { SpaceMember, SpaceRole } from '../api/spaces';
import { formatLongDate } from './utils/datetime';

const EVERYONE_ROLE = '@everyone';

/** Member’s assignable roles as `SpaceRole` rows for chips (excludes @everyone). Highest position first. */
export function rolesForMemberChips(
  roleIds: string[] | undefined,
  spaceRoles: SpaceRole[] | undefined,
): SpaceRole[] {
  if (!roleIds?.length || !spaceRoles?.length) return [];
  const byId = new Map(spaceRoles.map((r) => [r.id, r]));
  const everyoneId = spaceRoles.find((r) => r.name === EVERYONE_ROLE)?.id;
  const out: SpaceRole[] = [];
  for (const id of roleIds) {
    if (id === everyoneId) continue;
    const r = byId.get(id);
    if (r) out.push(r);
  }
  out.sort((a, b) => b.position - a.position);
  return out;
}

export function roleNamesForMember(
  roleIds: string[] | undefined,
  spaceRoles: SpaceRole[] | undefined
): string[] | undefined {
  if (!spaceRoles?.length || !roleIds?.length) return undefined;
  const byId = new Map(spaceRoles.map((r) => [r.id, r]));
  // Every member always has @everyone implicitly - showing it as a "role" badge is
  // meaningless (it doesn't distinguish anyone) and, before this filter, made the read-only
  // display (used by the full profile modal) disagree with the popover's own role-chip path
  // (rolesForMemberChips), which already excluded it - same member, two different answers.
  const resolved = roleIds
    .map((id) => byId.get(id))
    .filter((r): r is SpaceRole => !!r && r.name !== EVERYONE_ROLE);
  if (!resolved.length) return undefined;
  resolved.sort((a, b) => b.position - a.position);
  return resolved.map((r) => r.name);
}

export function spaceJoinedLabel(member: RoomParticipant): string | undefined {
  return formatLongDate((member as SpaceMember).joined_at);
}
