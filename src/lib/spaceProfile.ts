/**
 * Space profiles: the one rule for what name, avatar, banner, About Me, bio and pronouns a
 * person shows with inside a space.
 *
 * A member's row carries their global profile in the usual keys (`display_name`, `avatar`,
 * ...) and their space profile in separate ones (`nick`, `space_avatar`, ...; see
 * SPACE_PROFILE_KEYS). Nothing merges the two in a store - USER_UPDATE keeps writing the
 * global keys onto every member row - so every surface resolves at render time through
 * `resolveProfile`, and a space override can never leak into a PM, the friends list or
 * another space.
 *
 * Inside a space: space nickname > display name > username. A private friend nickname never
 * takes part there (no client shows friend nicknames in spaces); when friend nicknames get a
 * UI they apply only outside spaces.
 */
import type { SpaceMember, SpaceProfileFields, SpaceProfilePatch } from '../api/spaces';
import { auth } from '../stores/auth';
import { spaceMembers } from '../stores/spaceMembers';
import { t } from '../i18n';

/** The global profile a space profile overlays: auth.user for yourself, else a member or
 * participant row. Loose on purpose so every user-shaped object the client holds fits. */
export interface ProfileBase {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  banner?: string | null;
  about_me?: string | null;
  bio?: string | null;
  pronouns?: string | null;
}

export interface ResolvedProfile {
  /** What to call them here: nickname, else display name, else username, else the fallback. */
  name: string;
  /** Their global identity (display name, else username): shown small under a nickname. */
  globalName: string;
  username: string;
  /** The space nickname, when one is set. */
  nick?: string;
  avatar?: string;
  banner?: string;
  aboutMe?: string;
  bio?: string;
  pronouns?: string;
  /** Some space field (nick or space_*) overrode the global profile. */
  hasSpaceProfile: boolean;
}

/** The overlay argument. Typed as `SpaceProfileFields & ProfileBase` rather than the bare
 * fields so a member typed as a RoomParticipant (participant lists are) can be passed as is;
 * TypeScript refuses a type with none of the optional keys in common otherwise. */
type SpaceOverlay = SpaceProfileFields & ProfileBase;

/** null, undefined and whitespace-only all mean "not set". */
function present(v: string | null | undefined): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/**
 * THE rule. `base` = the global profile (auth.user for yourself, else the participant or
 * member); `space` = the member's row in the space being looked at (undefined outside a
 * space). Pure.
 */
export function resolveProfile(
  base: ProfileBase | null | undefined,
  space?: SpaceOverlay | null,
  fallback?: string
): ResolvedProfile {
  const fb = fallback ?? t('common.unknown');
  const nick = present(space?.nick);
  const globalName = present(base?.display_name) ?? present(base?.username) ?? fb;
  const avatar = present(space?.space_avatar);
  const banner = present(space?.space_banner);
  const aboutMe = present(space?.space_about_me);
  const bio = present(space?.space_bio);
  const pronouns = present(space?.space_pronouns);
  return {
    name: nick ?? globalName,
    globalName,
    username: present(base?.username) ?? '',
    ...(nick ? { nick } : {}),
    avatar: avatar ?? present(base?.avatar),
    banner: banner ?? present(base?.banner),
    aboutMe: aboutMe ?? present(base?.about_me),
    bio: bio ?? present(base?.bio),
    pronouns: pronouns ?? present(base?.pronouns),
    hasSpaceProfile: !!(nick || avatar || banner || aboutMe || bio || pronouns),
  };
}

/** The member row of userId in spaceId from the spaceMembers store (undefined if not loaded). */
export function spaceMemberOf(
  spaceId: string | null | undefined,
  userId: string | null | undefined
): SpaceMember | undefined {
  if (!spaceId || !userId) return undefined;
  return spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === userId);
}

/**
 * For surfaces that hold only an id (and maybe a server-sent user object): the global base is
 * auth.user for yourself - always the freshest copy of your own profile - else `base`, else the
 * member row; the overlay is always the member row of this space.
 */
export function resolveSpaceUser(
  spaceId: string | null | undefined,
  userId: string,
  base?: ProfileBase | null,
  fallback?: string
): ResolvedProfile {
  const member = spaceMemberOf(spaceId, userId);
  const self = auth.user && auth.user.id === userId ? auth.user : null;
  return resolveProfile(self ?? base ?? member, member, fallback);
}

/**
 * Whether a member has anything a reset would clear: any of the space avatar, banner, About
 * Me, bio or pronouns, plus the nickname unless `ignoreNick`. A moderator's reset never
 * touches the nickname (that is its own action), and a member without Change Nickname leaves
 * it out of their own reset, so both ask with `ignoreNick`.
 */
export function hasResettableSpaceProfile(
  m: SpaceOverlay | null | undefined,
  opts?: { ignoreNick?: boolean }
): boolean {
  if (!m) return false;
  if (!opts?.ignoreNick && present(m.nick)) return true;
  return !!(
    present(m.space_avatar) ||
    present(m.space_banner) ||
    present(m.space_about_me) ||
    present(m.space_bio) ||
    present(m.space_pronouns)
  );
}

/**
 * The PATCH body that resets a space profile to the global one. `includeNick` is false for a
 * moderator's reset of someone else (the server only lets those five be cleared, and the
 * nickname has its own action) and for your own reset when you lack Change Nickname - sending
 * `nick` then would make the server refuse the whole request.
 */
export function spaceProfileResetPatch(opts: { includeNick: boolean }): SpaceProfilePatch {
  return {
    ...(opts.includeNick ? { nick: null } : {}),
    avatar: null,
    banner: null,
    about_me: null,
    bio: null,
    pronouns: null,
  };
}
