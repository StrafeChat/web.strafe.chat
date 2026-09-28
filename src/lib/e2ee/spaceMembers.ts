import { ensureSpaceMembers, spaceMembers } from '../../stores/spaceMembers';

/**
 * Who a space room's Megolm session key has to be shared with: every current member of
 * the space (space rooms have no per-room participant list - the backend fans messages
 * out to space membership).
 *
 * Read from the members store, which live SPACE_MEMBER_* events keep current, so a send
 * normally costs no request at all. A stale list has a real cost here - a member missing
 * from it doesn't get the key and can't read anything sent under that session - so the
 * list is re-fetched when it is older than MAX_AGE_MS (a bound on how long a missed
 * event could matter), and after a gateway reconnect (see markSpaceMembersStale).
 */
const MAX_AGE_MS = 2 * 60_000;

export async function spaceMemberUserIds(spaceId: string): Promise<string[]> {
  const loadedAt = spaceMembers.loadedAt[spaceId];
  const stale = !loadedAt || Date.now() - loadedAt > MAX_AGE_MS;
  try {
    await ensureSpaceMembers(spaceId, { force: stale });
  } catch (e) {
    // Fall back to whatever is cached rather than failing the send outright.
    if (!spaceMembers.bySpaceId[spaceId]?.length) throw e;
  }
  return (spaceMembers.bySpaceId[spaceId] ?? []).map((m) => m.id);
}
