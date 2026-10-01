import { createStore } from 'solid-js/store';
import { listSpaceMembers, type SpaceMember } from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';
import { registerUserIdentity } from './federationIds';
import { setUserPresence } from './presence';
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
      for (const m of list) {
        if (m.presence?.status) setUserPresence(m.id, m.presence);
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
 * lists for instant rendering but make the next visit re-fetch them. */
export function markSpaceMembersStale(): void {
  setSpaceMembers('loadedAt', {});
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
        discriminator:
          typeof d.discriminator === 'number'
            ? d.discriminator
            : typeof d.discriminator === 'string'
              ? parseInt(d.discriminator, 10)
              : undefined,
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
      };
      upsertSpaceMember(spaceId, member);
      if (member.presence?.status) setUserPresence(member.id, member.presence);
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
      const roles = roleIdsFromPayload(d) ?? [];
      setSpaceMembers('bySpaceId', spaceId, (prev) => {
        const list = prev ?? [];
        const idx = list.findIndex((m) => m.id === uid);
        if (idx < 0) return list;
        return list.map((m, i) => (i === idx ? { ...m, roles } : m));
      });
    }
  });
}
