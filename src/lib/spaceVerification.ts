import {
  VERIFICATION_HIGH,
  VERIFICATION_LOW,
  VERIFICATION_MEDIUM,
  type Space,
  type SpaceMember,
} from '../api/spaces';
import { hasPerm, PermAdministrator, PermManageMessages } from './spacePermissions';

/**
 * A space's verification level, decided here as well as on the server, so the composer can
 * say "you cannot talk here yet, and this is why" instead of letting someone write a
 * message and refusing it afterwards. The server stays the authority - it refuses the send
 * either way (messages/automod.go); this only mirrors the same rule so the interface is
 * honest before the fact.
 *
 * The rules, cumulative, exactly as enforceVerificationLevel applies them:
 *   1 (low)    a verified email address
 *   2 (medium) + an account older than ACCOUNT_AGE_MS
 *   3 (high)   + membership of this space older than MEMBER_AGE_MS
 * Nobody with a role beyond @everyone is held to any of it, nor is anyone who may manage
 * messages or administrate - they are the people the moderators already vouched for.
 */
export const ACCOUNT_AGE_MS = 5 * 60 * 1000;
export const MEMBER_AGE_MS = 10 * 60 * 1000;

export type VerificationRequirement = 'email' | 'account_age' | 'member_age';

export interface VerificationGate {
  requirement: VerificationRequirement;
  /** For the two age rules: when the wait is over. Absent for 'email'. */
  unlockAt?: number;
}

export interface VerificationGateInput {
  space: Space | undefined;
  /** The viewer's member row in this space (for how long they have been in it). */
  member: SpaceMember | undefined;
  /** The viewer's effective permissions in the channel, or null while unknown. */
  channelMask: number | null;
  /** The signed-in account: whether its address is confirmed and when it was created. */
  verifiedEmail: boolean | undefined;
  accountCreatedAt: string | undefined;
  /** Whether this instance can send email at all. With no mailer the server skips the
   * email rule outright (nobody could ever pass it), so neither do we. */
  emailEnabled: boolean;
}

function msSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? now - t : null;
}

/**
 * What stops the viewer from talking in this space, or null when nothing does. The result
 * does not depend on the current time - an age rule reports *when* the wait ends - so a
 * caller can hold it steady and tick only the countdown.
 */
export function verificationGate(input: VerificationGateInput): VerificationGate | null {
  const space = input.space;
  const level = space?.verification_level ?? 0;
  if (!space || level <= 0) return null;

  // Vouched for: any role beyond @everyone, or the permissions a moderator holds.
  const roles = input.member?.roles ?? [];
  const hasRole = roles.some((r) => r !== space.everyone_role_id);
  if (hasRole) return null;
  const mask = input.channelMask;
  if (mask !== null && (hasPerm(mask, PermManageMessages) || hasPerm(mask, PermAdministrator))) return null;

  // A space hosted elsewhere judges us as one of its remote members, and for those the
  // origin only applies the membership rule: our address and account age are our own
  // instance's business, and it already vouched for us by federating.
  const mirrored = !!space.federation;

  if (!mirrored && level >= VERIFICATION_LOW && input.emailEnabled && input.verifiedEmail === false) {
    return { requirement: 'email' };
  }
  // Each rule only answers for itself: a wait that is already over must fall through to
  // the next rule, not end the search (an account past the age rule still owes the
  // membership one).
  if (!mirrored && level >= VERIFICATION_MEDIUM) {
    const created = input.accountCreatedAt ? Date.parse(input.accountCreatedAt) : NaN;
    if (Number.isFinite(created)) {
      const gate = gateIfWaiting('account_age', created + ACCOUNT_AGE_MS);
      if (gate) return gate;
    }
  }
  if (level >= VERIFICATION_HIGH) {
    const joined = input.member?.joined_at ? Date.parse(input.member.joined_at) : NaN;
    if (Number.isFinite(joined)) {
      const gate = gateIfWaiting('member_age', joined + MEMBER_AGE_MS);
      if (gate) return gate;
    }
  }
  return null;
}

/** An age rule only gates while its deadline is still ahead. */
function gateIfWaiting(requirement: VerificationRequirement, unlockAt: number): VerificationGate | null {
  return Date.now() < unlockAt ? { requirement, unlockAt } : null;
}

/** Whether a gate still applies at `now` (an age gate expires on its own). */
export function gateApplies(gate: VerificationGate | null, now: number): boolean {
  if (!gate) return false;
  return gate.unlockAt === undefined || now < gate.unlockAt;
}

/** The wait as m:ss, the way a countdown reads ("4:07"). Rounded up, never below 0:01. */
export function formatWait(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// msSince is kept for callers that want the elapsed side of the same clock.
export { msSince };
