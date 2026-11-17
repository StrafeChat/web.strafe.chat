import { defaultAvatarUrl, type DefaultAvatarSubject } from './defaultAvatar';
import { homeUserId } from '../stores/federationIds';

/**
 * Who an avatar belongs to, for picking their default: a user-shaped object (its `id`, and
 * `origin_id` when the payload carries one) or just the user id. Null/undefined (an unknown
 * sender) still gets a default, index 0.
 */
export type AvatarUser = DefaultAvatarSubject | AppUserRef | string | null | undefined;

/** The camelCase shape the app's own view models use (sender displays, profile subjects). */
export interface AppUserRef {
  userId?: string | null;
  originId?: string | null;
}

function toSubject(user: AvatarUser): DefaultAvatarSubject {
  if (user == null || typeof user !== 'object') return { id: user };
  if ('userId' in user || 'originId' in user) {
    const ref = user as AppUserRef;
    return { id: ref.userId, origin_id: ref.originId };
  }
  return user as DefaultAvatarSubject;
}

/**
 * This client's default avatar URL for a user. A remote user's payload does not always carry
 * `origin_id` (a message author is only an id), so the federation identity registry fills it
 * in from any payload that did - the colour then matches what their home instance shows.
 */
export function userDefaultAvatarUrl(user: AvatarUser): string {
  const subject = toSubject(user);
  const origin = subject.origin_id ?? (typeof subject.id === 'string' ? homeUserId(subject.id) : undefined);
  return defaultAvatarUrl({ id: subject.id, origin_id: origin });
}

/** The picture to show for a user: their avatar when they have one, else their default. */
export function userAvatarUrl(avatar: string | null | undefined, user: AvatarUser): string {
  return avatar || userDefaultAvatarUrl(user);
}

/** Absolute form of a URL, for consumers outside the page (system notification icons). */
export function absoluteUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}
