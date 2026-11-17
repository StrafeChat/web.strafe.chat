/**
 * Default avatars: the picture a person has until they upload one.
 *
 * Like Discord's, it is one of a fixed set of images picked from the user id, so the same
 * person always gets the same colour without anything being stored. The set lives in
 * `public/avatars/default/0.png` … `7.png` (256 px PNGs, Strafe's mark in white on a
 * colour; `scripts/make-default-avatars.py` draws them), served by every instance at
 * `<web origin>/avatars/default/<index>.png`.
 *
 *   index = (BigInt(homeId) >> 22n) % 8n
 *
 * `homeId` is the id the person's *home* instance knows them by: for someone from another
 * instance that is the `origin_id` their payloads carry (the id here is only this instance's
 * shadow row), for a local account its own id. That keeps a person the same colour on every
 * instance. The shift drops a snowflake's worker and sequence bits, so the pick follows the
 * creation time rather than whichever worker minted the id.
 *
 * The order of the images is part of the contract (other clients, bots and the docs compute
 * the same index): never reorder, recolour in place, or change the count.
 *
 * Pure and dependency-free on purpose, so `scripts/check-default-avatar.mjs` can run it
 * under plain Node and other clients can copy it as-is.
 */

/** How many default avatars there are. Fixed: changing it would move everyone. */
export const DEFAULT_AVATAR_COUNT = 8;

/** Where the images live, relative to the web client's origin. */
export const DEFAULT_AVATAR_PATH = '/avatars/default';

/** Anything shaped enough like a user to pick a default avatar for. */
export interface DefaultAvatarSubject {
  /** This instance's id for the user (a decimal snowflake). */
  id?: string | number | bigint | null;
  /** The id their home instance knows them by, on someone from another instance. */
  origin_id?: string | number | bigint | null;
}

export type DefaultAvatarInput = DefaultAvatarSubject | string | number | bigint | null | undefined;

const DECIMAL = /^\d+$/;

function toSnowflake(v: string | number | bigint | null | undefined): bigint | null {
  if (v == null) return null;
  if (typeof v === 'bigint') return v >= 0n ? v : null;
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? BigInt(v) : null;
  const s = v.trim();
  return DECIMAL.test(s) ? BigInt(s) : null;
}

/**
 * The id that decides the default avatar: the home id (`origin_id`) when the subject has a
 * usable one, otherwise its own id. A bare string/number/bigint is taken as that id.
 * Returns null when neither is a valid snowflake.
 */
export function defaultAvatarHomeId(user: DefaultAvatarInput): bigint | null {
  if (user == null) return null;
  if (typeof user !== 'object') return toSnowflake(user);
  return toSnowflake(user.origin_id) ?? toSnowflake(user.id);
}

/** 0 … 7: which default avatar a user gets. Missing or invalid ids get 0. */
export function defaultAvatarIndex(user: DefaultAvatarInput): number {
  const id = defaultAvatarHomeId(user);
  if (id == null) return 0;
  return Number((id >> 22n) % BigInt(DEFAULT_AVATAR_COUNT));
}

/**
 * URL of a user's default avatar. With no `origin` it is root-relative
 * (`/avatars/default/3.png`), which is what this client wants; pass the instance's web
 * origin (e.g. `https://app.strafe.chat`) for an absolute one. A trailing slash is fine.
 */
export function defaultAvatarUrl(user: DefaultAvatarInput, origin = ''): string {
  return `${origin.replace(/\/+$/, '')}${DEFAULT_AVATAR_PATH}/${defaultAvatarIndex(user)}.png`;
}
