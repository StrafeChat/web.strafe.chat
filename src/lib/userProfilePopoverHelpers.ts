import type { RoomParticipant } from '../api/rooms';
import type { SpaceMember, SpaceRole } from '../api/spaces';
import type { SenderDisplay } from '../components/messageList/utils';
import type { UserProfilePopoverSubject } from '../stores/userProfilePopover';
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
    spaceRoleNames: roleNamesForMember(participantRoleIds(p), spaceRoles),
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
    spaceRoleNames: roleNamesForMember(p ? participantRoleIds(p) : undefined, opts?.spaceRoles),
    joinedAtLabel: p ? spaceJoinedLabel(p) : undefined,
    publicFlags: s.publicFlags,
    bot: s.bot,
  };
}
