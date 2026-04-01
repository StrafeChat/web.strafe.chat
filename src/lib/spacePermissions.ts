import type { SpaceRole, SpaceRoomOverride } from '../api/spaces';

/** Mirrors equinox/internal/modules/permissions/bits.go (number, JSON-safe). */
export const PermViewChannel = 1 << 0;
export const PermSendMessages = 1 << 1;
export const PermReadMessageHistory = 1 << 2;
export const PermAddReactions = 1 << 3;
export const PermUseExternalEmojis = 1 << 4;
export const PermMentionEveryone = 1 << 5;
export const PermManageMessages = 1 << 6;
export const PermManageRoles = 1 << 7;
export const PermManageRooms = 1 << 8;
export const PermKickMembers = 1 << 9;
export const PermBanMembers = 1 << 10;
export const PermAdministrator = 1 << 11;
export const PermManageSpace = 1 << 12;

export const SPACE_ROLE_PERM_ROWS: { bit: number; label: string; description: string }[] = [
  { bit: PermViewChannel, label: 'View channel', description: 'See channels and read their names.' },
  { bit: PermSendMessages, label: 'Send messages', description: 'Send messages in text channels.' },
  { bit: PermReadMessageHistory, label: 'Read message history', description: 'Read previous messages in channels.' },
  { bit: PermAddReactions, label: 'Add reactions', description: 'Add emoji reactions to messages.' },
  { bit: PermUseExternalEmojis, label: 'Use external emojis', description: 'Use emojis from other servers or Unicode.' },
  { bit: PermMentionEveryone, label: 'Mention @everyone', description: 'Ping @everyone in channels where allowed.' },
  { bit: PermManageMessages, label: 'Manage messages', description: 'Delete or pin others’ messages.' },
  { bit: PermManageRoles, label: 'Manage roles', description: 'Create, edit, and assign roles below their own.' },
  { bit: PermManageRooms, label: 'Manage channels', description: 'Create, edit, and delete channels.' },
  { bit: PermKickMembers, label: 'Kick members', description: 'Remove members from the space.' },
  { bit: PermBanMembers, label: 'Ban members', description: 'Permanently ban members from the space.' },
  {
    bit: PermAdministrator,
    label: 'Administrator',
    description: 'Grants all permissions and bypasses channel restrictions. Highly sensitive.',
  },
  { bit: PermManageSpace, label: 'Manage space', description: 'Edit space name, icon, and global settings.' },
];

export function hasPerm(mask: number, bit: number): boolean {
  return (mask & bit) === bit;
}

export function togglePerm(mask: number, bit: number, on: boolean): number {
  if (on) return mask | bit;
  return mask & ~bit;
}

/** Mirrors equinox/internal/modules/permissions/bits.go AllRoom. */
export const AllRoomPermMask =
  PermViewChannel |
  PermSendMessages |
  PermReadMessageHistory |
  PermAddReactions |
  PermUseExternalEmojis |
  PermMentionEveryone |
  PermManageMessages;

/** Discord-style overwrite stack (same as permissions.ApplyOverwrites). */
export function applyRoomOverwrites(base: number, overwrites: { allow: number; deny: number }[]): number {
  let p = base;
  for (const o of overwrites) {
    p = (p & ~o.deny) | o.allow;
  }
  return p;
}

export interface EffectiveChannelPermInput {
  memberUserId: string;
  ownerId: string;
  everyoneRoleId: string | undefined;
  memberRoleIds: string[] | undefined;
  roles: SpaceRole[];
  overrides: SpaceRoomOverride[];
}

/**
 * Effective channel permission bits for a member in a space room (mirrors spaces.Service.EffectiveChannelPermissions).
 * Returns null if @everyone role id cannot be resolved (caller should not filter).
 */
export function effectiveChannelPermissionsForMember(input: EffectiveChannelPermInput): number | null {
  const { memberUserId, ownerId, memberRoleIds, roles, overrides } = input;
  if (memberUserId === ownerId) {
    return AllRoomPermMask;
  }

  const everyoneId =
    input.everyoneRoleId ?? roles.find((r) => r.name === '@everyone')?.id;
  if (!everyoneId) {
    return null;
  }

  const byId = new Map(roles.map((r) => [r.id, r]));

  let base = 0;
  const everyone = byId.get(everyoneId);
  if (everyone) {
    base |= everyone.permissions;
  }

  const memIds = memberRoleIds ?? [];
  for (const rid of memIds) {
    if (rid === everyoneId) continue;
    const r = byId.get(rid);
    if (r) {
      base |= r.permissions;
    }
  }

  if (hasPerm(base, PermAdministrator)) {
    return AllRoomPermMask;
  }

  const ovByRole = new Map(overrides.map((o) => [o.role_id, o]));

  const roleOrder: string[] = [everyoneId];
  const rest: { id: string; pos: number }[] = [];
  const seen = new Set<string>([everyoneId]);
  for (const rid of memIds) {
    if (seen.has(rid)) continue;
    seen.add(rid);
    const r = byId.get(rid);
    const pos = r != null ? r.position : 0x7fffffff;
    rest.push({ id: rid, pos });
  }
  rest.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    return a.id.localeCompare(b.id);
  });
  for (const rp of rest) {
    roleOrder.push(rp.id);
  }

  const stack: { allow: number; deny: number }[] = [];
  for (const rid of roleOrder) {
    const o = ovByRole.get(rid);
    if (o) {
      stack.push({ allow: o.allow, deny: o.deny });
    }
  }

  return applyRoomOverwrites(base, stack);
}

/** 24-bit RGB role color for CSS. */
export function spaceRoleColorHex(c: number): string {
  const u = c >>> 0;
  return `#${(u & 0xffffff).toString(16).padStart(6, '0')}`;
}

/** Among roles the member has with `hoist`, pick the highest by `position`. */
export function highestHoistedRole(
  memberRoleIds: string[] | undefined,
  roles: SpaceRole[] | undefined
): SpaceRole | undefined {
  if (!memberRoleIds?.length || !roles?.length) return undefined;
  const hoisted = roles.filter((r) => r.hoist && memberRoleIds.includes(r.id));
  if (hoisted.length === 0) return undefined;
  return hoisted.reduce((a, b) => (b.position > a.position ? b : a));
}
