import { hasAnyPerm, orPerms } from './permBits';
import {
  channelOverridesSource,
  effectiveChannelPermissionsForMember,
  hasPerm,
  PermKickMembers,
  PermManageMessages,
  PermManageRoles,
  PermManageWebhooks,
  PermMentionEveryone,
} from './spacePermissions';
import { spaces } from '../stores/spaces';
import { spaceMembers } from '../stores/spaceMembers';
import { auth } from '../stores/auth';
import type { SpaceMember } from '../api/spaces';

/**
 * The signed-in member's effective permissions in one space room, from the roles and
 * overrides the client already holds (READY + gateway events), or null while they are not
 * known. Reactive when read inside a computation. Only for deciding what to *offer*: the
 * server checks every action itself.
 */
export function myRoomMask(spaceId: string | undefined, roomId: string | undefined): number | null {
  const me = auth.user?.id;
  if (!me || !spaceId || !roomId) return null;
  const sp = spaces.spaces.find((s) => s.id === spaceId);
  const roles = sp?.roles;
  const allRooms = spaces.spaceRoomsBySpaceId[spaceId];
  const room = allRooms?.find((r) => r.id === roomId);
  if (!sp || !roles || !room) return null;
  const { overrides, userOverrides } = channelOverridesSource(room, allRooms);
  if (overrides === undefined) return null;
  const member = spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === me) as SpaceMember | undefined;
  // READY does not carry one's own member row in every case; the role ids then come from the
  // space's own member list, and with neither only @everyone counts (never more than the truth).
  return effectiveChannelPermissionsForMember({
    memberUserId: me,
    ownerId: sp.owner_id,
    everyoneRoleId: sp.everyone_role_id,
    memberRoleIds: member?.roles,
    roles,
    overrides,
    userOverrides,
  });
}

/** May the signed-in member manage this room's webhooks (Manage Webhooks, bit 31)? */
export function canManageWebhooksIn(spaceId: string | undefined, roomId: string | undefined): boolean {
  const mask = myRoomMask(spaceId, roomId);
  return mask !== null && hasPerm(mask, PermManageWebhooks);
}

/** May the signed-in member ping @everyone in this room (and so let a webhook do it)? */
export function canMentionEveryoneIn(spaceId: string | undefined, roomId: string | undefined): boolean {
  const mask = myRoomMask(spaceId, roomId);
  return mask !== null && hasPerm(mask, PermMentionEveryone);
}

/** May the signed-in member block a bridged person from a bridge in this room (Kick Members,
 * or Manage Messages there - spec 5.6)? */
export function canBlockBridgedIn(spaceId: string | undefined, roomId: string | undefined): boolean {
  const mask = myRoomMask(spaceId, roomId);
  return mask !== null && hasAnyPerm(mask, orPerms(PermKickMembers, PermManageMessages));
}

/** May the signed-in member let a bridge's people carry name colours (Manage Roles - D-11)? */
export function canManageRolesIn(spaceId: string | undefined, roomId: string | undefined): boolean {
  const mask = myRoomMask(spaceId, roomId);
  return mask !== null && hasPerm(mask, PermManageRoles);
}
