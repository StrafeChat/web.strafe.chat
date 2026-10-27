import { effectiveChannelPermissionsForMember, channelOverridesSource, voicePermsFromMask, type VoicePerms } from '../spacePermissions';
import { spaces } from '../../stores/spaces';
import { spaceMembers } from '../../stores/spaceMembers';
import type { SpaceMember } from '../../api/spaces';
import { resolveProfile } from '../spaceProfile';

/**
 * A member's voice permissions in a room, from the locally held roles and overrides.
 * PMs (no space) are fully permissive for the member's own actions and offer no
 * moderation; so is a space whose roles or overrides are not known yet.
 */
export function voicePermsFor(userId: string | undefined, spaceId: string | undefined, roomId: string | undefined): VoicePerms {
  if (!userId || !spaceId || !roomId) return voicePermsFromMask(null);
  const sp = spaces.spaces.find((s) => s.id === spaceId);
  const roles = sp?.roles;
  const allRooms = spaces.spaceRoomsBySpaceId[spaceId];
  const room = allRooms?.find((r) => r.id === roomId);
  const { overrides, userOverrides } = channelOverridesSource(room, allRooms);
  if (!sp || !roles || !room || overrides === undefined || userOverrides === undefined) {
    return voicePermsFromMask(null);
  }
  const member = spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === userId) as SpaceMember | undefined;
  const mask = effectiveChannelPermissionsForMember({
    memberUserId: userId,
    ownerId: sp.owner_id,
    everyoneRoleId: sp.everyone_role_id,
    memberRoleIds: member?.roles,
    roles,
    overrides,
    userOverrides,
  });
  return voicePermsFromMask(mask);
}

/** Display name for a voice participant from whatever we know about them: in a space room,
 * their nickname there when they have one. */
export function voiceParticipantName(
  userId: string,
  state: { user?: { display_name?: string; username?: string } } | undefined,
  spaceId?: string
): string {
  if (spaceId) {
    const m = spaceMembers.bySpaceId[spaceId]?.find((x) => x.id === userId);
    if (m) return resolveProfile(m, m).name;
  }
  return state?.user?.display_name || state?.user?.username || '…';
}
