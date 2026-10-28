import { createStore, produce } from 'solid-js/store';
import { listSpaceMembers, SPACE_PROFILE_KEYS, type SpaceMember, type SpaceProfileFields } from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';
import { registerUserIdentity } from './federationIds';
import { dropActivitiesOutsideAudience, setUserPresence } from './presence';
// Read only inside functions, never at load: auth imports stores that import this one.
import { auth } from './auth';
import { stargateEventInnerRecord } from './spaceSync';

/**
 * Space member lists, fetched once per space per gateway session and then kept current
 * by SPACE_MEMBER_ADD / REMOVE / UPDATE events - the same idea as a Discord client's
 * member cache (Discord goes further and only streams the visible slice of the sidebar;
 * spaces here are small enough that one list per space is the right trade).
 *
 * `loadedAt` is the freshness marker: unset means "never fetched, or stale since the last
 * reconnect" (see markSpaceMembersStale), so a visit fetches; set means the cached list
 * is authoritative and a visit costs nothing.
 */
export interface SpaceMembersState {
  bySpaceId: Record<string, SpaceMember[]>;
  loading: Record<string, boolean>;
  loadedAt: Record<string, number>;
}

export const [spaceMembers, setSpaceMembers] = createStore<SpaceMembersState>({
  bySpaceId: {},
  loading: {},
  loadedAt: {},
});

const inflight = new Map<string, Promise<void>>();

/** Fetch a space's members unless the cached list is still authoritative. Concurrent
 * callers share one request. */
export function ensureSpaceMembers(spaceId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!spaceId) return Promise.resolve();
  if (!opts.force && spaceMembers.loadedAt[spaceId]) return Promise.resolve();
  const pending = inflight.get(spaceId);
  if (pending) return pending;
  const p = (async () => {
    setSpaceMembers('loading', spaceId, true);
    try {
      const list = await listSpaceMembers(spaceId);
      setSpaceMembers('bySpaceId', spaceId, list);
      setSpaceMembers('loadedAt', spaceId, Date.now());
      // Seed the global presence map so the status dot agrees with the online/offline
      // grouping - without this a member the sidebar lists as online showed an offline
      // dot, because the dot reads only presence.byUser and the list also falls back to
      // the member object's own presence.
      const self = auth.user?.id;
      for (const m of list) {
        // Member rows carry the member's activity, so a fresh list replaces it. Not our own
        // row: it is the view others get (invisible reads offline, with no activity), and
        // ours comes from READY and PRESENCE_UPDATE on our own channel.
        if (m.presence?.status && m.id !== self) setUserPresence(m.id, m.presence, { activities: true });
        // Members of a space that spans instances carry their home; the E2EE engine
        // needs it to address their devices.
        registerUserIdentity(m);
      }
    } finally {
      setSpaceMembers('loading', spaceId, false);
      inflight.delete(spaceId);
    }
  })();
  inflight.set(spaceId, p);
  return p;
}

/** Unconditional refresh - for explicit user actions whose result must show right away. */
export function loadSpaceMembers(spaceId: string): Promise<void> {
  return ensureSpaceMembers(spaceId, { force: true });
}

/** After a gateway (re)connect nothing that happened while offline was seen; keep the
 * lists for instant rendering but make the next visit re-fetch them.
 *
 * `produce`, not `setSpaceMembers('loadedAt', {})`: a store setter handed a plain object
 * merges it, so an empty one changed nothing and every list stayed "fresh" - a member who
 * joined during a short disconnect was then left out of an E2EE room's key share. */
export function markSpaceMembersStale(): void {
  setSpaceMembers(
    produce((s) => {
      s.loadedAt = {};
    })
  );
}

export function upsertSpaceMember(spaceId: string, member: SpaceMember): void {
  if (!spaceId || !member.id) return;
  registerUserIdentity(member);
  setSpaceMembers('bySpaceId', spaceId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === member.id);
    if (idx >= 0) return list.map((m, i) => (i === idx ? { ...m, ...member } : m));
    return [...list, member];
  });
}

function roleIdsFromPayload(d: Record<string, unknown>): string[] | undefined {
  const raw = d.role_ids;
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.map((x) => String(x)).filter(Boolean);
  return ids.length ? ids : undefined;
}

/** A space-profile key off the wire: the string when it says something, else null (cleared). */
function profileValue(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** All six space-profile keys, for a payload that is the member's full state (SPACE_MEMBER_ADD). */
function profileFromPayload(d: Record<string, unknown>): SpaceProfileFields {
  const out: SpaceProfileFields = {};
  for (const k of SPACE_PROFILE_KEYS) out[k] = profileValue(d[k]);
  return out;
}

/** Listen for space member WebSocket events and keep member lists in sync. */
export function initSpaceMembersHandlers(): () => void {
  return onStargateEvent((event) => {
    if (event.t === 'SPACE_ROLE_DELETE') {
      // Drop the role from every member holding it - no refetch needed.
      const d = stargateEventInnerRecord(event);
      const spaceId =
        (d?.space_id != null ? String(d.space_id) : null) ??
        (event.space_id != null ? String(event.space_id) : null);
      const roleId = d?.role_id != null ? String(d.role_id) : null;
      if (!spaceId || !roleId) return;
      setSpaceMembers('bySpaceId', spaceId, (prev) =>
        (prev ?? []).map((m) => (m.roles?.includes(roleId) ? { ...m, roles: m.roles.filter((r) => r !== roleId) } : m))
      );
      return;
    }

    if (event.t === 'SPACE_MEMBER_ADD') {
      const payload = (event.d as { d?: unknown })?.d ?? event.d;
      if (!payload || typeof payload !== 'object') return;
      const d = payload as Record<string, unknown>;
      const spaceId = d.space_id != null ? String(d.space_id) : event.space_id;
      if (!spaceId) return;
      const id = d.id != null ? String(d.id) : null;
      if (!id) return;
      const roles = roleIdsFromPayload(d);
      const member: SpaceMember = {
        id,
        username: typeof d.username === 'string' ? d.username : '',
        display_name: typeof d.display_name === 'string' ? d.display_name : '',
        avatar: typeof d.avatar === 'string' ? d.avatar : undefined,
        banner: typeof d.banner === 'string' ? d.banner : undefined,
        bio: typeof d.bio === 'string' ? d.bio : undefined,
        about_me: typeof d.about_me === 'string' ? d.about_me : undefined,
        presence:
          d.presence && typeof d.presence === 'object'
            ? (d.presence as import('../api/relationships').UserPresence)
            : undefined,
        joined_at: typeof d.joined_at === 'string' ? d.joined_at : new Date().toISOString(),
        ...(roles ? { roles } : {}),
        // Shaped like a listed member: a newcomer from another instance needs home_domain and
        // origin_id for the E2EE engine to address their devices (upsertSpaceMember registers
        // them) - without them this room's keys went to an identity with no devices - and the
        // rest is what their handle, BOT tag, badges and pronouns render from.
        ...(typeof d.pronouns === 'string' && d.pronouns ? { pronouns: d.pronouns } : {}),
        ...(typeof d.public_flags === 'number' ? { public_flags: d.public_flags } : {}),
        ...(d.bot === true ? { bot: true } : {}),
        ...(d.system === true ? { system: true } : {}),
        ...(typeof d.home_domain === 'string' && d.home_domain ? { home_domain: d.home_domain } : {}),
        ...(d.origin_id != null && d.origin_id !== '' ? { origin_id: String(d.origin_id) } : {}),
        // The space profile, always all six (null = none): an add is full state, so a member
        // re-added over a stale row must not keep the old nickname or images.
        ...profileFromPayload(d),
      };
      upsertSpaceMember(spaceId, member);
      // Our own join is the view others get, like our row in a list (see above).
      if (member.presence?.status && member.id !== auth.user?.id) {
        setUserPresence(member.id, member.presence, { activities: true });
      }
      return;
    }

    if (event.t === 'SPACE_MEMBER_REMOVE') {
      const d = stargateEventInnerRecord(event);
      const spaceId =
        (d?.space_id != null ? String(d.space_id) : null) ??
        (event.space_id != null ? String(event.space_id) : null);
      const uid = d?.user_id != null ? String(d.user_id) : null;
      if (!spaceId || !uid) return;
      setSpaceMembers('bySpaceId', spaceId, (prev) => (prev ?? []).filter((m) => m.id !== uid));
      // They left this space: their game stays shown only if we still share a friendship or
      // another space with them. Nothing tells us when it changes otherwise.
      dropActivitiesOutsideAudience([uid]);
      return;
    }

    if (event.t === 'SPACE_MEMBER_UPDATE') {
      const payload = (event.d as { d?: unknown })?.d ?? event.d;
      if (!payload || typeof payload !== 'object') return;
      const d = payload as Record<string, unknown>;
      const spaceId = d.space_id != null ? String(d.space_id) : event.space_id;
      if (!spaceId) return;
      const uid = d.user_id != null ? String(d.user_id) : null;
      if (!uid) return;
      // A patch of only what the event names. The server sends the full state (role_ids and
      // all six profile keys) every time, but replacing roles with `role_ids ?? []` - what
      // this did before space profiles - would wipe a member's roles on any event that left
      // them out, and their colour, hoisting and permissions with them.
      const patch: Partial<SpaceMember> = {};
      if ('role_ids' in d) patch.roles = Array.isArray(d.role_ids) ? d.role_ids.map((x) => String(x)).filter(Boolean) : [];
      for (const k of SPACE_PROFILE_KEYS) {
        if (k in d) patch[k] = profileValue(d[k]);
      }
      setSpaceMembers('bySpaceId', spaceId, (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((m) => m.id === uid);
        if (idx < 0) return list;
        return list.map((m, i) => (i === idx ? { ...m, ...patch } : m));
      });
    }
  });
}
