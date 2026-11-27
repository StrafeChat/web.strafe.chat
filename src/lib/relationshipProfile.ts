import type { Relationship } from '../api/relationships';
import type { UserProfileFullSubject } from '../stores/userProfileFullModal';
import { friendDisplayName } from '../stores/relationships';

/**
 * The global account behind a relationship row, shaped for the full profile modal. Friend
 * requests and the friends list open the same profile a member row or message author does,
 * so the relationship payload is mapped here once rather than at each call site.
 */
export function profileSubjectFromRelationship(rel: Relationship): UserProfileFullSubject {
  const user = rel.user;
  return {
    userId: user.id,
    displayName: friendDisplayName(rel),
    username: user.username,
    homeDomain: user.home_domain,
    avatar: user.avatar,
    banner: user.banner,
    bio: user.bio,
    aboutMe: user.about_me,
    pronouns: user.pronouns,
    birthday: user.birthday,
    birthdayToday: user.is_birthday,
  };
}
