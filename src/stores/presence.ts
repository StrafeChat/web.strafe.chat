/**
 * Presence handler – listens for PRESENCE_UPDATE WebSocket events and updates
 * both the relationships store (for friends list) and a global presence map
 * so any part of the app can show real-time online status.
 */

import { batch, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import { onStargateEvent } from '../services/stargate/client';
import { patchMe } from '../api/users';
// Read only inside functions, never at load: those stores import this one.
import { relationshipType, updatePresence, RelType } from './relationships';
import { spaceMembers } from './spaceMembers';
import { spaces } from './spaces';
import { auth } from './auth';
import { normalizeActivities, sameActivities, type Activity } from '../lib/activity';

export type { Activity } from '../lib/activity';

export interface UserPresence {
  status: 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';
  custom_status?: string;
  /** What they are playing (at most one), from the gateway's ephemeral store - never saved. */
  activities?: Activity[];
}

export interface PresenceState {
  /** user_id -> presence (status, custom_status, activities). undefined = unknown. */
  byUser: Record<string, UserPresence>;
}

export const [presence, setPresence] = createStore<PresenceState>({
  byUser: {},
});

/** Update a user's presence. Called from PRESENCE_UPDATE handler.
 *
 * Always writes status and custom status: a store setter handed an object merges it into the
 * stored one, and the server leaves `custom_status` out when it is empty (READY, room
 * participants, friends, member lists), so a status cleared while this client was offline
 * survived a reconnect. A key present as undefined is deleted by the merge.
 *
 * Activities are written only with `{ activities: true }`, and then always (absent clears).
 * The server attaches them to a few payloads only - PRESENCE_UPDATE, your own presence in
 * READY and GET /users/@me, friend entries, and space member rows - and every other payload
 * that embeds a presence (a room's participants, a friend request, the notes room, an
 * optimistic status edit) simply has none. Letting those write would wipe a live "Playing X"
 * on every room open, and PRESENCE_UPDATE only comes again when the game changes. So the
 * other paths leave the stored activities alone. An unchanged activity is not rewritten, so
 * what reads it does not re-render. */
export function setUserPresence(userId: string, p: UserPresence, opts?: { activities?: boolean }): void {
  const base = { status: p.status, custom_status: p.custom_status };
  if (opts?.activities !== true) {
    setPresence('byUser', userId, base);
    return;
  }
  const next = normalizeActivities(p.activities);
  const prev = untrack(() => presence.byUser[userId]?.activities);
  setPresence('byUser', userId, sameActivities(prev, next) ? base : { ...base, activities: next });
}

/** What the user is playing, if anything - only while they are present (online, idle or
 * dnd), the same rule as every status line. Reads only the presence store: the presence a
 * member row or room participant embeds is a snapshot from when the list was fetched, and
 * falling back to it would bring a finished game back. Reactive. */
export function activityOf(userId: string | undefined): Activity | undefined {
  if (!userId) return undefined;
  const p = presence.byUser[userId];
  if (!p || !isPresentStatus(p.status)) return undefined;
  return p.activities?.[0];
}

/** A user's custom status: the presence store's when it has an entry for them, the row's
 * own snapshot (a member row, a room participant, a relationship) only when it has none.
 * Never `store ?? snapshot`: a status cleared since the list was fetched is absent from the
 * store, and falling back would bring the old text back - and with it hide "Playing X",
 * which a custom status beats. Reactive. */
export function customStatusOf(
  userId: string | undefined,
  snapshot?: { custom_status?: string } | null,
): string | undefined {
  const entry = userId ? presence.byUser[userId] : undefined;
  return (entry ? entry.custom_status : snapshot?.custom_status) || undefined;
}

/** Forget what a user is playing (their status stays). For someone who has just left
 * everything that showed it to us; PRESENCE_UPDATE stops coming for them, so nothing else
 * would ever clear it. */
export function dropActivity(userId: string): void {
  if (untrack(() => presence.byUser[userId]?.activities) === undefined) return;
  setPresence('byUser', userId, 'activities', undefined);
}

/** Whether we still share something with this user that shows us their activity: they are
 * a friend, or a member of a space we are in whose member list is loaded (that list is what
 * gave us the activity, and refetching it brings the current one). Not reactive. */
function inActivityAudience(userId: string): boolean {
  return untrack(() => {
    if (relationshipType(userId) === RelType.Friend) return true;
    for (const s of spaces.spaces) {
      if (spaceMembers.bySpaceId[s.id]?.some((m) => m.id === userId)) return true;
    }
    return false;
  });
}

/**
 * Drop the activity of each of these users we no longer share a friendship or a loaded
 * space member list with: after an unfriend or a block, a member leaving a space, or our
 * leaving one (removeSpace drops the space first, so its own list no longer counts). Never
 * our own - that is what our devices report, whoever else can see it.
 */
export function dropActivitiesOutsideAudience(userIds: Iterable<string>): void {
  const self = untrack(() => auth.user?.id);
  batch(() => {
    for (const id of userIds) {
      if (id && id !== self && !inActivityAudience(id)) dropActivity(id);
    }
  });
}

/**
 * After READY: whatever we missed while the socket was down includes people leaving our
 * audience, and no event will tell us now. Keep the activity of READY's friends (their
 * entries just rewrote it) and of members of the spaces we are still in whose lists are
 * loaded (those lists are refetched on the next visit); drop everyone else's.
 */
export function pruneActivitiesAfterReady(): void {
  const ids = untrack(() => Object.keys(presence.byUser).filter((id) => presence.byUser[id]?.activities !== undefined));
  dropActivitiesOutsideAudience(ids);
}

/** Bumped by every own-status change, so only the newest one applies or rolls back. */
let ownStatusSeq = 0;

/**
 * Change our own status (the status menu): saved with PATCH /users/@me.
 *
 * Instant between online, idle and dnd (rolled back if the save fails). A change to or from
 * invisible shows only once the server has taken it: the game this device reports
 * (stores/activity.ts) follows our own status, and applied early, its clear - or, leaving
 * invisible, its re-send - reached the gateway before the new status was saved, so the
 * gateway fanned the activity change out (and federated it) with the old one, a stale
 * "online" to everyone. Rejects when the save fails.
 */
export async function setOwnStatus(status: UserPresence['status']): Promise<void> {
  const id = untrack(() => auth.user?.id);
  if (!id) return;
  const cur = untrack(() => presence.byUser[id]);
  // Plain values: `cur` is a live store proxy and would read the new status after the update.
  const prev: UserPresence | undefined = cur ? { status: cur.status, custom_status: cur.custom_status } : undefined;
  const waits = status === 'invisible' || prev?.status === 'invisible';
  const mine = ++ownStatusSeq;
  if (!waits) setUserPresence(id, { status, custom_status: prev?.custom_status });
  try {
    await patchMe({ presence: { status } });
  } catch (err) {
    if (!waits && prev && mine === ownStatusSeq) setUserPresence(id, prev);
    throw err;
  }
  // The PRESENCE_UPDATE on our own channel may already have brought it; the custom status is
  // whatever is current now.
  if (waits && mine === ownStatusSeq) {
    setUserPresence(id, { status, custom_status: untrack(() => presence.byUser[id]?.custom_status) });
  }
}

/** True if status indicates user is "visible" (online or idle). */
export function isVisibleStatus(status: string | undefined): boolean {
  return status === 'online' || status === 'idle';
}

/** True when the status counts as "present" - online, idle or dnd. offline / invisible /
 * unknown are not present, and a status line (custom status or label) is hidden for them,
 * matching how the space members list already behaves. */
export function isPresentStatus(status: string | undefined): boolean {
  return status === 'online' || status === 'idle' || status === 'dnd';
}

/** The current user's own presence status ('offline' when unknown). Reactive: reads the
 * presence store, so callers inside effects/JSX re-run when the user changes their status. */
export function selfStatus(): UserPresence['status'] {
  const id = auth.user?.id;
  return (id ? presence.byUser[id]?.status : undefined) ?? 'offline';
}

/** Do Not Disturb: while the user's own status is dnd, message and friend-request
 * notifications (sound + desktop) are suppressed, matching Discord. In-app unread badges
 * are unaffected - DND silences the interruptions, it doesn't hide activity. */
export function notificationsSuppressedByStatus(): boolean {
  return selfStatus() === 'dnd';
}

export function initPresenceHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'PRESENCE_UPDATE') return;

    const payload = (event.d as {
      d?: { user_id?: string; presence?: { status?: string; custom_status?: string; activities?: unknown } };
    })?.d;
    const userId = payload?.user_id;
    const p = payload?.presence;
    if (userId == null || !p?.status) return;

    // Space broadcasts carry the "others" view (invisible → offline). Applying that to our
    // OWN user would wrongly show us offline; our real status arrives on the user channel
    // (no space_id), so ignore a self update that came in via a space.
    if (event.space_id && userId === auth.user?.id) return;

    const valid = ['online', 'idle', 'dnd', 'offline', 'invisible'].includes(p.status);
    if (!valid) return;
    const presence: UserPresence = {
      status: p.status as UserPresence['status'],
      custom_status: p.custom_status,
      activities: normalizeActivities(p.activities),
    };
    // Every PRESENCE_UPDATE carries the user's current activity (none = not playing).
    setUserPresence(userId, presence, { activities: true });
    updatePresence(userId, presence);
  });
}
