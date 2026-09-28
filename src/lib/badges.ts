/**
 * Profile badges. The server stores them as a bitfield in the user's `public_flags` (the
 * same shape Discord uses); this is the client's view - which bit is which badge, and how
 * to draw it. Keep the bit values in lockstep with equinox `internal/modules/auth/badges.go`.
 *
 * The Bot badge is not a bit: it comes from the account's `bot` flag and is appended last.
 */
export interface BadgeDef {
  id: string;
  bit: number;
  icon: string;
  /** Accent for the icon; badges are meant to be recognised by colour + shape at a glance. */
  color: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'founder', bit: 1 << 0, icon: 'fa-crown', color: '#f5c542' },
  { id: 'staff', bit: 1 << 1, icon: 'fa-shield-halved', color: '#5865f2' },
  { id: 'support', bit: 1 << 2, icon: 'fa-headset', color: '#3ba55d' },
  { id: 'contributor', bit: 1 << 3, icon: 'fa-code-branch', color: '#eb459e' },
  { id: 'translator', bit: 1 << 4, icon: 'fa-language', color: '#00a8fc' },
  { id: 'bugDiscloser', bit: 1 << 5, icon: 'fa-bug', color: '#f0b232' },
  { id: 'alphaTester', bit: 1 << 6, icon: 'fa-flask', color: '#9b59b6' },
];

/** Every assignable bit OR'd together - used by the admin editor and to mask stray bits. */
export const ALL_BADGE_BITS = BADGES.reduce((m, b) => m | b.bit, 0);

/** The badges a user has, in display order, from their public_flags bitfield. */
export function badgesFor(publicFlags: number | undefined): BadgeDef[] {
  const f = publicFlags ?? 0;
  return BADGES.filter((b) => (f & b.bit) !== 0);
}
