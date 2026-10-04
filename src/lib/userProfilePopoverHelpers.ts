import type { RoomParticipant } from '../api/rooms';
import type { SpaceMember, SpaceRole } from '../api/spaces';
import type { SenderDisplay } from '../components/messageList/utils';
import type { ProfileRole, UserProfilePopoverSubject } from '../stores/userProfilePopover';
import { memberNameColorHex as sharedMemberNameColorHex } from './spacePermissions';
import { birthdayIsToday } from './utils/birthday';
import { formatLongDate } from './utils/datetime';
import { t } from '../i18n';

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

/**
 * The same list, narrowed to what a profile surface needs: name and colour, no permissions
 * and no ids to keep in sync. Returns undefined (rather than []) when the member has none, so
 * the "Roles" section simply doesn't render.
 *
 * One resolver for both profile surfaces on purpose. The popover has live role chips with
 * remove buttons and the full modal has a read-only list, and when each resolved roles its
 * own way the same person could be shown with different roles depending on which one opened.
 */
export function rolesForMemberProfile(
  roleIds: string[] | undefined,
  spaceRoles: SpaceRole[] | undefined
): ProfileRole[] | undefined {
  const rows = rolesForMemberChips(roleIds, spaceRoles);
  if (!rows.length) return undefined;
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color ?? 0 }));
}

/**
 * The colour a member's name is drawn in. Delegates to the shared `memberNameColorHex` in
 * spacePermissions so profiles, chat and the member list can't drift apart on it.
 */
export function memberNameColorHex(
  roleIds: string[] | undefined,
  spaceRoles: SpaceRole[] | undefined
): string | undefined {
  return sharedMemberNameColorHex(roleIds, spaceRoles);
}

export function spaceJoinedLabel(member: RoomParticipant): string | undefined {
  return formatLongDate((member as SpaceMember).joined_at);
}

/** A participant's role ids, when a space-scoped participant carries them. */
function participantRoleIds(p: RoomParticipant): string[] | undefined {
  return (p as { roles?: string[] }).roles;
}

/**
 * The one place a profile popover/drawer subject is built from a rich space/room
 * participant (member list, voice tile). Every field the popover and the full-profile
 * modal can show is mapped here, so the same person looks identical no matter which
 * surface opened them - see also `popoverSubjectFromSender` for the message-side path.
 */
export function popoverSubjectFromParticipant(
  p: RoomParticipant,
  spaceRoles?: SpaceRole[],
): UserProfilePopoverSubject {
  return {
    userId: p.id,
    displayName: p.display_name || p.username || t('common.unknown'),
    username: p.username,
    discriminator: p.discriminator ?? 0,
    homeDomain: p.home_domain,
    avatar: p.avatar,
    banner: p.banner,
    aboutMe: p.about_me,
    bio: p.bio,
    pronouns: p.pronouns,
    birthday: p.birthday,
    birthdayToday: p.birthday ? birthdayIsToday(p.birthday, p.is_birthday) : false,
    spaceRoles: rolesForMemberProfile(participantRoleIds(p), spaceRoles),
    nameColor: memberNameColorHex(participantRoleIds(p), spaceRoles),
    joinedAtLabel: spaceJoinedLabel(p),
    publicFlags: p.public_flags,
    bot: p.bot,
  };
}

/**
 * Builds the same subject shape from a message-side `SenderDisplay` (chat, search, pinned).
 * Pass the matching participant when one is on hand so space roles and the join date come
 * through too; without it the identity fields (name, avatar, banner, badges, about me,
 * home domain) are still populated consistently.
 */
export function popoverSubjectFromSender(
  s: SenderDisplay,
  opts?: { participant?: RoomParticipant; spaceRoles?: SpaceRole[] },
): UserProfilePopoverSubject {
  const p = opts?.participant;
  return {
    userId: s.userId,
    displayName: s.name,
    username: s.username || t('common.unknown').toLowerCase(),
    discriminator: s.discriminator ?? 0,
    homeDomain: s.homeDomain ?? p?.home_domain,
    avatar: s.avatar,
    banner: s.banner,
    aboutMe: s.aboutMe,
    bio: s.bio,
    pronouns: s.pronouns,
    birthday: s.birthday,
    birthdayToday: birthdayIsToday(s.birthday, s.isBirthday),
    spaceRoles: rolesForMemberProfile(p ? participantRoleIds(p) : undefined, opts?.spaceRoles),
    nameColor: memberNameColorHex(p ? participantRoleIds(p) : undefined, opts?.spaceRoles),
    joinedAtLabel: p ? spaceJoinedLabel(p) : undefined,
    publicFlags: s.publicFlags,
    bot: s.bot,
  };
}
