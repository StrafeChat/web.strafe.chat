import { effectiveChannelPermissionsForMember, voicePermsFromMask, type VoicePerms } from '../spacePermissions';
import { spaces } from '../../stores/spaces';
import { spaceMembers } from '../../stores/spaceMembers';
import type { SpaceMember } from '../../api/spaces';

/**
 * A member's voice permissions in a room, from the locally held roles and overrides.
 * PMs (no space) are fully permissive for the member's own actions and offer no
 * moderation; so is a space whose roles or overrides are not known yet.
 */
export function voicePermsFor(userId: string | undefined, spaceId: string | undefined, roomId: string | undefined): VoicePerms {
  if (!userId || !spaceId || !roomId) return voicePermsFromMask(null);
  const sp = spaces.spaces.find((s) => s.id === spaceId);
  const roles = sp?.roles;
  const room = spaces.spaceRoomsBySpaceId[spaceId]?.find((r) => r.id === roomId);
  if (!sp || !roles || !room || room.permission_overrides === undefined || room.user_overrides === undefined) {
    return voicePermsFromMask(null);
  }
  const member = spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === userId) as SpaceMember | undefined;
  const mask = effectiveChannelPermissionsForMember({
    memberUserId: userId,
    ownerId: sp.owner_id,
    everyoneRoleId: sp.everyone_role_id,
    memberRoleIds: member?.roles,
    roles,
    overrides: room.permission_overrides,
    userOverrides: room.user_overrides,
  });
  return voicePermsFromMask(mask);
}

/** Display name for a voice participant from whatever we know about them. */
export function voiceParticipantName(
  userId: string,
  state: { user?: { display_name?: string; username?: string } } | undefined,
  spaceId?: string
): string {
  if (spaceId) {
    const m = spaceMembers.bySpaceId[spaceId]?.find((x) => x.id === userId);
    if (m) return m.display_name || m.username;
  }
  return state?.user?.display_name || state?.user?.username || '…';
}
