import type { SpaceRole, SpaceRoomOverride, SpaceRoomUserOverride } from '../api/spaces';
import { t } from '../i18n';

/** Mirrors equinox/internal/modules/permissions/bits.go. Bit positions are permanent once
 * shipped (stored in role.permissions) - only ever append a new bit, never renumber one. */
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
export const PermCreateInvite = 1 << 13;
export const PermManageEmojis = 1 << 14;
/** Voice bits (room-scoped). */
export const PermConnect = 1 << 15;
export const PermSpeak = 1 << 16;
export const PermVideo = 1 << 17;
export const PermMuteMembers = 1 << 18;
export const PermDeafenMembers = 1 << 19;
export const PermMoveMembers = 1 << 20;
export const PermUseVAD = 1 << 21;
export const PermPrioritySpeaker = 1 << 22;

export const AllVoicePermMask =
  PermConnect |
  PermSpeak |
  PermVideo |
  PermMuteMembers |
  PermDeafenMembers |
  PermMoveMembers |
  PermUseVAD |
  PermPrioritySpeaker;

export interface PermRow {
  bit: number;
  /** Stable identifier used for the i18n keys. */
  key: string;
  label: string;
  description: string;
}

/** A permission row; `label`/`description` resolve through i18n on every read. */
function row(bit: number, key: string, ns: 'rows' | 'roomRows' = 'rows'): PermRow {
  return {
    bit,
    key,
    get label() {
      return t(`permissions.${ns}.${key}.label`);
    },
    get description() {
      return t(`permissions.${ns}.${key}.description`);
    },
  };
}

function group(categoryKey: string, rows: PermRow[]): { category: string; rows: PermRow[] } {
  return {
    get category() {
      return t(`permissions.categories.${categoryKey}`);
    },
    rows,
  };
}

/** Space-wide permissions grouped the way Discord's role editor groups them. */
export const SPACE_ROLE_PERM_GROUPS: { category: string; rows: PermRow[] }[] = [
  group('general', [
    row(PermAdministrator, 'administrator'),
    row(PermManageSpace, 'manageSpace'),
    row(PermManageRoles, 'manageRoles'),
    row(PermManageRooms, 'manageRooms'),
    row(PermManageEmojis, 'manageEmojis'),
    row(PermCreateInvite, 'createInvite'),
  ]),
  group('membership', [row(PermKickMembers, 'kickMembers'), row(PermBanMembers, 'banMembers')]),
  group('text', [
    row(PermViewChannel, 'viewRoom'),
    row(PermSendMessages, 'sendMessages'),
    row(PermReadMessageHistory, 'readMessageHistory'),
    row(PermAddReactions, 'addReactions'),
    row(PermUseExternalEmojis, 'useExternalEmojis'),
    row(PermMentionEveryone, 'mentionEveryone'),
    row(PermManageMessages, 'manageMessages'),
  ]),
  group('voice', [
    row(PermConnect, 'connect'),
    row(PermSpeak, 'speak'),
    row(PermVideo, 'video'),
    row(PermUseVAD, 'useVAD'),
    row(PermPrioritySpeaker, 'prioritySpeaker'),
    row(PermMuteMembers, 'muteMembers'),
    row(PermDeafenMembers, 'deafenMembers'),
    row(PermMoveMembers, 'moveMembers'),
  ]),
];

/** Flattened for search and for anything that just wants every row. */
export const SPACE_ROLE_PERM_ROWS: PermRow[] = SPACE_ROLE_PERM_GROUPS.flatMap((g) => g.rows);

/** Per-channel overrides: only bits that make sense scoped to one room (mirrors equinox
 * permissions.AllRoom - no space-management bits, since those aren't room-scoped). */
export const ROOM_OVERRIDE_PERM_ROWS: PermRow[] = [
  row(PermViewChannel, 'viewRoom', 'roomRows'),
  row(PermSendMessages, 'sendMessages', 'roomRows'),
  row(PermReadMessageHistory, 'readMessageHistory', 'roomRows'),
  row(PermAddReactions, 'addReactions', 'roomRows'),
  row(PermUseExternalEmojis, 'useExternalEmojis', 'roomRows'),
  row(PermMentionEveryone, 'mentionEveryone', 'roomRows'),
  row(PermManageMessages, 'manageMessages', 'roomRows'),
];

/** Overrides that apply to a voice room: viewing it, plus every voice bit. */
export const VOICE_ROOM_OVERRIDE_PERM_ROWS: PermRow[] = [
  row(PermViewChannel, 'viewRoom', 'roomRows'),
  row(PermConnect, 'connect', 'roomRows'),
  row(PermSpeak, 'speak', 'roomRows'),
  row(PermVideo, 'video', 'roomRows'),
  row(PermUseVAD, 'useVAD', 'roomRows'),
  row(PermPrioritySpeaker, 'prioritySpeaker', 'roomRows'),
  row(PermMuteMembers, 'muteMembers', 'roomRows'),
  row(PermDeafenMembers, 'deafenMembers', 'roomRows'),
  row(PermMoveMembers, 'moveMembers', 'roomRows'),
];

/** The voice slice of an effective permission mask. A null mask (roles unknown) is
 * treated as fully permissive for the member's own actions and non-permissive for
 * moderation, so nothing is offered that the server would refuse. */
export interface VoicePerms {
  connect: boolean;
  speak: boolean;
  video: boolean;
  muteMembers: boolean;
  deafenMembers: boolean;
  moveMembers: boolean;
  vad: boolean;
  priority: boolean;
}

export function voicePermsFromMask(mask: number | null): VoicePerms {
  if (mask === null) {
    return { connect: true, speak: true, video: true, muteMembers: false, deafenMembers: false, moveMembers: false, vad: true, priority: false };
  }
  return {
    connect: hasPerm(mask, PermConnect),
    speak: hasPerm(mask, PermSpeak),
    video: hasPerm(mask, PermVideo),
    muteMembers: hasPerm(mask, PermMuteMembers),
    deafenMembers: hasPerm(mask, PermDeafenMembers),
    moveMembers: hasPerm(mask, PermMoveMembers),
    vad: hasPerm(mask, PermUseVAD),
    priority: hasPerm(mask, PermPrioritySpeaker),
  };
}

export function hasPerm(mask: number, bit: number): boolean {
  return (mask & bit) === bit;
}

/** True if the effective mask allows sending messages in the channel. */
export function canSendMessagesInChannel(mask: number | null): boolean {
  if (mask === null) return true;
  return hasPerm(mask, PermViewChannel) && hasPerm(mask, PermSendMessages);
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
  PermManageMessages |
  AllVoicePermMask;

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
  userOverrides?: SpaceRoomUserOverride[];
}

/**
 * Effective channel permission bits for a member in a space room (mirrors spaces.Service.EffectiveChannelPermissions).
 * Returns null if @everyone role id cannot be resolved (caller should not filter).
 */
export function effectiveChannelPermissionsForMember(input: EffectiveChannelPermInput): number | null {
  const { memberUserId, ownerId, memberRoleIds, roles, overrides, userOverrides } = input;
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

  let perms = base;

  // 1) @everyone overwrite.
  const everyoneOverride = overrides.find((o) => o.role_id === everyoneId);
  if (everyoneOverride) {
    perms = (perms & ~everyoneOverride.deny) | everyoneOverride.allow;
  }

  // 2) aggregate role overwrites (excluding @everyone), deny then allow.
  const memberRoleSet = new Set(memIds.filter((rid) => rid !== everyoneId));
  let roleDeny = 0;
  let roleAllow = 0;
  for (const o of overrides) {
    if (!memberRoleSet.has(o.role_id)) continue;
    roleDeny |= o.deny;
    roleAllow |= o.allow;
  }
  perms = (perms & ~roleDeny) | roleAllow;

  // 3) user overwrite (if present), deny then allow.
  const userOverride = userOverrides?.find((o) => o.user_id === memberUserId);
  if (userOverride) {
    perms = (perms & ~userOverride.deny) | userOverride.allow;
  }

  return perms;
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

function memberEffectivePermBase(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): number | null {
  if (!space || !userId || !roles?.length) return null;
  if (space.owner_id === userId) return null;
  const everyoneId = space.everyone_role_id ?? roles.find((r) => r.name === '@everyone')?.id;
  const byId = new Map(roles.map((r) => [r.id, r]));
  let base = 0;
  if (everyoneId) base |= byId.get(everyoneId)?.permissions ?? 0;
  for (const rid of member?.roles ?? []) {
    if (rid === everyoneId) continue;
    base |= byId.get(rid)?.permissions ?? 0;
  }
  return base;
}

/** Owner or roles that include Manage space — edit icon, name, and other space-wide settings. */
export function memberCanManageSpace(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermManageSpace) || hasPerm(base, PermAdministrator);
}

/** Owner or Manage emojis / Manage space / Administrator — upload and rename custom emoji. */
export function memberCanManageEmojis(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermManageEmojis) || hasPerm(base, PermManageSpace) || hasPerm(base, PermAdministrator);
}

/** Owner or Manage rooms / Administrator — create, rename, reorder and delete rooms. */
export function memberCanManageRooms(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermManageRooms) || hasPerm(base, PermAdministrator);
}

/** Owner or Manage roles / Administrator — create and edit roles, assign members. */
export function memberCanManageRoles(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermManageRoles) || hasPerm(base, PermAdministrator);
}

/** Owner or Kick members / Administrator. */
export function memberCanKickMembers(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermKickMembers) || hasPerm(base, PermAdministrator);
}

/** Owner or Ban members / Administrator. */
export function memberCanBanMembers(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermBanMembers) || hasPerm(base, PermAdministrator);
}

/** Highest position among a member's roles, excluding @everyone (always the floor, 0).
 * -1 if they hold no role above @everyone. Mirrors equinox's highestRolePosition -
 * used so the UI can pre-emptively hide kick/ban/edit-role actions the server would
 * reject for outranking the target (or the role), instead of only erroring after the fact. */
export function memberHighestRolePosition(
  everyoneRoleId: string | undefined,
  roles: SpaceRole[] | undefined,
  member: { roles?: string[] } | undefined
): number {
  if (!roles?.length) return -1;
  const everyoneId = everyoneRoleId ?? roles.find((r) => r.name === '@everyone')?.id;
  const byId = new Map(roles.map((r) => [r.id, r]));
  let highest = -1;
  for (const rid of member?.roles ?? []) {
    if (rid === everyoneId) continue;
    const pos = byId.get(rid)?.position;
    if (pos != null && pos > highest) highest = pos;
  }
  return highest;
}

/**
 * How high a viewer may reach when handing out roles: no ceiling for the space owner,
 * otherwise their own highest role's position. A role at or above this cannot be added
 * or removed by them — the server applies the same rule in SetMemberRoles, so the UI
 * locks those toggles instead of letting the save come back 403.
 */
export function viewerRoleCeiling(
  spaceOwnerId: string | undefined,
  viewerId: string | undefined,
  roles: SpaceRole[] | undefined,
  members: { id: string; roles?: string[] }[] | undefined,
  everyoneRoleId?: string
): number {
  if (!viewerId) return -1;
  if (spaceOwnerId && spaceOwnerId === viewerId) return Number.POSITIVE_INFINITY;
  return memberHighestRolePosition(everyoneRoleId, roles, members?.find((m) => m.id === viewerId));
}

/** Owner or Create invite / Administrator — matches the server default (on for @everyone). */
export function memberCanCreateInvite(
  space: { owner_id: string; everyone_role_id?: string } | undefined,
  roles: SpaceRole[] | undefined,
  member: { id: string; roles?: string[] } | undefined,
  userId: string | undefined
): boolean {
  if (!space || !userId || !roles?.length) return false;
  if (space.owner_id === userId) return true;
  const base = memberEffectivePermBase(space, roles, member, userId);
  if (base === null) return false;
  return hasPerm(base, PermCreateInvite) || hasPerm(base, PermAdministrator);
}
