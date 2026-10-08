import { auth } from './auth';
import { createStore, produce } from 'solid-js/store';
import {
  getSpaceRooms,
  listSpaceRoles,
  listSpaces,
  type Space,
  type SpaceRole,
  type SpaceRoom,
  type SpaceRoomOverride,
  type SpaceRoomUserOverride,
  type ThreadInfo,
} from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';
import { getThread } from '../api/threads';
import { removeRoom } from './rooms';
import { registerRoomIdentity } from './federationIds';
import { setReadStateFromRoom } from './readState';

/**
 * Spaces, their rooms, their roles and every room's permission overrides.
 *
 * This mirrors how a Discord client keeps a guild: READY (like GUILD_CREATE) delivers the
 * roles with the space and the overrides with each channel, gateway events patch that
 * state in place, and permissions are computed locally from it. Nothing here is fetched
 * per navigation - opening a channel reads the store; REST is only the fallback for a
 * space that arrived without those fields (an older server) or an explicit refresh.
 */
export interface SpacesState {
  spaces: Space[];
  /** Space rooms by space id (from READY or after fetch). */
  spaceRoomsBySpaceId: Record<string, SpaceRoom[]>;
  loading: boolean;
  hydrated: boolean;
}

export const [spaces, setSpaces] = createStore<SpacesState>({
  spaces: [],
  spaceRoomsBySpaceId: {},
  loading: false,
  hydrated: false,
});

export async function loadSpaces(): Promise<void> {
  setSpaces({ loading: true });
  try {
    const list = await listSpaces();
    setSpaces({ spaces: list, loading: false, hydrated: true });
  } catch {
    setSpaces({ loading: false, hydrated: true });
  }
}

export function clearSpaces() {
  setSpaces({ spaces: [], spaceRoomsBySpaceId: {}, loading: false, hydrated: false });
  rolesInflight.clear();
  roomsInflight.clear();
}

/** Add or update a single space (e.g. from SPACE_CREATE / SPACE_UPDATE). Idempotent.
 * Merges into the stored space so a payload without `roles` (SPACE_UPDATE carries only
 * the space's own fields) keeps the roles already loaded. */
export function addOrUpdateSpace(space: Space): void {
  setSpaces('spaces', (list) => {
    const idx = list.findIndex((s) => s.id === space.id);
    if (idx >= 0) return list.map((s, i) => (i === idx ? { ...s, ...space } : s));
    return [...list, space];
  });
}

/** Drop a space from local state (kicked, banned, left - including from another session). */
export function removeSpace(spaceId: string): void {
  // Also drop the space's channels from the rooms store. The channel being viewed is mirrored
  // there (SpacePage.addOrUpdateRoom, for the send path), and if left behind the gateway-
  // subscription effect keeps a reference on it - so its subscribe ref count never returns to
  // zero, and rejoining the space later never re-sends a Subscribe frame (subscribe() early-
  // returns on a non-zero count). That was the "no live events after leaving and rejoining a
  // space" bug: a rejoin was treated differently from a first join, which starts from a clean
  // ref count. Collect the ids before deleting the room list below.
  const roomIds = (spaces.spaceRoomsBySpaceId[spaceId] ?? []).map((r) => r.id);
  setSpaces('spaces', (list) => list.filter((s) => s.id !== spaceId));
  // `produce`, not a spread copy: a store setter handed a plain object *merges* it, so
  // "everything except this key" quietly leaves the space's room list cached forever.
  setSpaces(
    produce((s) => {
      delete s.spaceRoomsBySpaceId[spaceId];
    })
  );
  for (const rid of roomIds) removeRoom(rid);
}

// ---- roles -----------------------------------------------------------------------------

const rolesInflight = new Map<string, Promise<void>>();

function sortRoles(list: SpaceRole[]): SpaceRole[] {
  return [...list].sort((a, b) => (a.position !== b.position ? a.position - b.position : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The roles of a space (undefined until known). */
export function spaceRoles(spaceId: string): SpaceRole[] | undefined {
  return spaces.spaces.find((s) => s.id === spaceId)?.roles;
}

export function setSpaceRoles(spaceId: string, roles: SpaceRole[]): void {
  const sorted = sortRoles(roles);
  setSpaces('spaces', (list) => list.map((s) => (s.id === spaceId ? { ...s, roles: sorted } : s)));
}

/** Make sure a space's roles are known, fetching them only when the space arrived
 * without them. A no-op on the normal path (READY already carried them). */
export function ensureSpaceRoles(spaceId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!spaceId) return Promise.resolve();
  if (!opts.force && spaceRoles(spaceId) !== undefined) return Promise.resolve();
  const pending = rolesInflight.get(spaceId);
  if (pending) return pending;
  const p = listSpaceRoles(spaceId)
    .then((roles) => setSpaceRoles(spaceId, roles))
    .catch(() => undefined)
    .finally(() => rolesInflight.delete(spaceId));
  rolesInflight.set(spaceId, p);
  return p;
}

export function upsertSpaceRole(spaceId: string, role: SpaceRole): void {
  setSpaces('spaces', (list) =>
    list.map((s) => {
      if (s.id !== spaceId) return s;
      const current = s.roles ?? [];
      const idx = current.findIndex((r) => r.id === role.id);
      const next = idx >= 0 ? current.map((r, i) => (i === idx ? { ...r, ...role } : r)) : [...current, role];
      return { ...s, roles: sortRoles(next) };
    })
  );
}

export function removeSpaceRole(spaceId: string, roleId: string): void {
  setSpaces('spaces', (list) =>
    list.map((s) => (s.id !== spaceId || !s.roles ? s : { ...s, roles: s.roles.filter((r) => r.id !== roleId) }))
  );
  // A deleted role's overrides go with it.
  setSpaces('spaceRoomsBySpaceId', spaceId, (rooms) =>
    (rooms ?? []).map((r) =>
      r.permission_overrides?.some((o) => o.role_id === roleId)
        ? { ...r, permission_overrides: r.permission_overrides.filter((o) => o.role_id !== roleId) }
        : r
    )
  );
}

function roleFromPayload(d: Record<string, unknown>): SpaceRole | null {
  const id = d.id != null ? String(d.id) : null;
  if (!id) return null;
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    permissions: typeof d.permissions === 'number' ? d.permissions : 0,
    position: typeof d.position === 'number' ? d.position : 0,
    color: typeof d.color === 'number' ? d.color : 0,
    hoist: d.hoist === true,
    mentionable: d.mentionable === true,
    bot_id: d.bot_id != null ? String(d.bot_id) : undefined,
    created_at: d.created_at != null ? String(d.created_at) : '',
    updated_at: d.updated_at != null ? String(d.updated_at) : '',
  };
}

function rolesFromPayload(raw: unknown): SpaceRole[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SpaceRole[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const r = roleFromPayload(item as Record<string, unknown>);
      if (r) out.push(r);
    }
  }
  return sortRoles(out);
}

// ---- room permission overrides -----------------------------------------------------------

function overrideFromPayload(d: Record<string, unknown>): SpaceRoomOverride | null {
  const roleId = d.role_id != null ? String(d.role_id) : null;
  if (!roleId) return null;
  return {
    role_id: roleId,
    allow: typeof d.allow === 'number' ? d.allow : 0,
    deny: typeof d.deny === 'number' ? d.deny : 0,
    created_at: d.created_at != null ? String(d.created_at) : '',
    updated_at: d.updated_at != null ? String(d.updated_at) : '',
  };
}

function userOverrideFromPayload(d: Record<string, unknown>): SpaceRoomUserOverride | null {
  const userId = d.user_id != null ? String(d.user_id) : null;
  if (!userId) return null;
  return {
    user_id: userId,
    allow: typeof d.allow === 'number' ? d.allow : 0,
    deny: typeof d.deny === 'number' ? d.deny : 0,
    created_at: d.created_at != null ? String(d.created_at) : '',
    updated_at: d.updated_at != null ? String(d.updated_at) : '',
  };
}

function overridesFromPayload(raw: unknown): SpaceRoomOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SpaceRoomOverride[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const o = overrideFromPayload(item as Record<string, unknown>);
      if (o) out.push(o);
    }
  }
  return out;
}

function userOverridesFromPayload(raw: unknown): SpaceRoomUserOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SpaceRoomUserOverride[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const o = userOverrideFromPayload(item as Record<string, unknown>);
      if (o) out.push(o);
    }
  }
  return out;
}

/** A room's overrides from the store; each list is undefined when the room is unknown or
 * arrived without override data (callers then fall back to permissive defaults). */
export function roomOverrides(
  spaceId: string,
  roomId: string
): { roles: SpaceRoomOverride[] | undefined; users: SpaceRoomUserOverride[] | undefined } {
  const room = spaces.spaceRoomsBySpaceId[spaceId]?.find((r) => r.id === roomId);
  return { roles: room?.permission_overrides, users: room?.user_overrides };
}

function patchRoom(spaceId: string, roomId: string, patch: (r: SpaceRoom) => SpaceRoom): void {
  setSpaces('spaceRoomsBySpaceId', spaceId, (list) => (list ?? []).map((r) => (r.id === roomId ? patch(r) : r)));
}

export function applyRoomRoleOverride(spaceId: string, roomId: string, o: SpaceRoomOverride): void {
  patchRoom(spaceId, roomId, (r) => {
    const rest = (r.permission_overrides ?? []).filter((x) => x.role_id !== o.role_id);
    return { ...r, permission_overrides: [...rest, o] };
  });
}

export function removeRoomRoleOverride(spaceId: string, roomId: string, roleId: string): void {
  patchRoom(spaceId, roomId, (r) => ({
    ...r,
    permission_overrides: (r.permission_overrides ?? []).filter((x) => x.role_id !== roleId),
  }));
}

export function applyRoomUserOverride(spaceId: string, roomId: string, o: SpaceRoomUserOverride): void {
  patchRoom(spaceId, roomId, (r) => {
    const rest = (r.user_overrides ?? []).filter((x) => x.user_id !== o.user_id);
    return { ...r, user_overrides: [...rest, o] };
  });
}

export function removeRoomUserOverride(spaceId: string, roomId: string, userId: string): void {
  patchRoom(spaceId, roomId, (r) => ({
    ...r,
    user_overrides: (r.user_overrides ?? []).filter((x) => x.user_id !== userId),
  }));
}

// ---- payload normalisation ------------------------------------------------------------------

/** Normalize SPACE_CREATE / SPACE_UPDATE payload to Space shape. */
function spaceFromPayload(payload: unknown): Space | null {
  if (!payload || typeof payload !== 'object') return null;
  const d = payload as Record<string, unknown>;
  const id = d.id != null ? String(d.id) : null;
  if (!id) return null;
  const created_at =
    d.created_at instanceof Date
      ? d.created_at.toISOString()
      : typeof d.created_at === 'string'
        ? d.created_at
        : new Date().toISOString();
  const updated_at =
    d.updated_at instanceof Date
      ? d.updated_at.toISOString()
      : typeof d.updated_at === 'string'
        ? d.updated_at
        : created_at;
  const roles = rolesFromPayload(d.roles);
  return {
    id,
    name: typeof d.name === 'string' ? d.name : '',
    name_acronym: typeof d.name_acronym === 'string' ? d.name_acronym : '',
    description: typeof d.description === 'string' ? d.description : '',
    icon: typeof d.icon === 'string' ? d.icon : '',
    banner: typeof d.banner === 'string' ? d.banner : '',
    owner_id: d.owner_id != null ? String(d.owner_id) : '',
    official: d.official === true,
    verification_level: typeof d.verification_level === 'number' ? d.verification_level : 0,
    // Every field a space carries has to be listed here: this mapper is what READY and every
    // SPACE_UPDATE go through, so one left out silently resets on the next refresh.
    automod_flags: typeof d.automod_flags === 'number' ? d.automod_flags : 0,
    automod_mention_limit: typeof d.automod_mention_limit === 'number' ? d.automod_mention_limit : 0,
    default_message_notifications:
      typeof d.default_message_notifications === 'number' ? d.default_message_notifications : 0,
    explicit_content_filter: typeof d.explicit_content_filter === 'number' ? d.explicit_content_filter : 0,
    features: Array.isArray(d.features) ? (d.features as string[]) : [],
    afk_timeout: typeof d.afk_timeout === 'number' ? d.afk_timeout : 0,
    system_room_flags: typeof d.system_room_flags === 'number' ? d.system_room_flags : 0,
    max_presences: typeof d.max_presences === 'number' ? d.max_presences : 0,
    max_members: typeof d.max_members === 'number' ? d.max_members : 0,
    vanity_url_code: typeof d.vanity_url_code === 'string' ? d.vanity_url_code : '',
    preferred_locale: typeof d.preferred_locale === 'string' ? d.preferred_locale : '',
    max_video_room_users: typeof d.max_video_room_users === 'number' ? d.max_video_room_users : 0,
    created_at,
    updated_at,
    widget_enabled: d.widget_enabled === true,
    ...(d.widget_room_id != null && { widget_room_id: String(d.widget_room_id) }),
    ...(d.afk_room_id != null && { afk_room_id: String(d.afk_room_id) }),
    ...(d.system_room_id != null && { system_room_id: String(d.system_room_id) }),
    ...(d.birthday_channel_id != null && { birthday_channel_id: String(d.birthday_channel_id) }),
    ...(typeof d.birthday_message === 'string' && { birthday_message: d.birthday_message }),
    ...(d.rules_room_id != null && { rules_room_id: String(d.rules_room_id) }),
    ...(d.public_updates_room_id != null && { public_updates_room_id: String(d.public_updates_room_id) }),
    ...(d.everyone_role_id != null && { everyone_role_id: String(d.everyone_role_id) }),
    ...(roles ? { roles } : {}),
    ...(federationFromPayload(d.federation) ? { federation: federationFromPayload(d.federation)! } : {}),
  };
}

/** The `federation` field of a space or room payload (a mirror's origin), if well-formed. */
function federationFromPayload(raw: unknown): { origin_domain: string; origin_id: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (typeof f.origin_domain !== 'string' || !f.origin_domain || f.origin_id == null) return null;
  return { origin_domain: f.origin_domain, origin_id: String(f.origin_id) };
}

/** Normalize a raw room from READY space_rooms (or a SPACE_ROOM_CREATE event, which uses
 * the same shape) to SpaceRoom. */
function spaceRoomFromReady(d: Record<string, unknown>): SpaceRoom | null {
  const id = d.id != null ? String(d.id) : d.room_id != null ? String(d.room_id) : null;
  if (!id) return null;
  const created_at =
    d.created_at instanceof Date
      ? d.created_at.toISOString()
      : typeof d.created_at === 'string'
        ? d.created_at
        : new Date().toISOString();
  const updated_at =
    d.updated_at != null
      ? d.updated_at instanceof Date
        ? d.updated_at.toISOString()
        : String(d.updated_at)
      : created_at;
  const permission_overrides = overridesFromPayload(d.permission_overrides);
  const user_overrides = userOverridesFromPayload(d.user_overrides);
  const federation = federationFromPayload(d.federation);
  const thread = threadFromPayload(d.thread);
  // The E2EE engine keys a federated channel's sessions by its global identity.
  if (federation) registerRoomIdentity({ id, federation });
  return {
    id,
    type: typeof d.type === 'number' ? d.type : 3,
    ...(federation ? { federation } : {}),
    name: typeof d.name === 'string' ? d.name : '',
    topic: typeof d.topic === 'string' ? d.topic : undefined,
    position: typeof d.position === 'number' ? d.position : 0,
    ...(typeof d.slowmode_seconds === 'number' && { slowmode_seconds: d.slowmode_seconds }),
    ...(typeof d.e2ee_enabled === 'boolean' && { e2ee_enabled: d.e2ee_enabled }),
    ...(typeof d.permissions_synced === 'boolean' && { permissions_synced: d.permissions_synced }),
    ...(typeof d.user_limit === 'number' && { user_limit: d.user_limit }),
    ...(typeof d.bitrate === 'number' && { bitrate: d.bitrate }),
    ...(thread ? { thread } : {}),
    ...(permission_overrides ? { permission_overrides } : {}),
    ...(user_overrides ? { user_overrides } : {}),
    created_at,
    updated_at,
    ...(d.space_id != null && { space_id: String(d.space_id) }),
    ...(d.parent_id != null && { parent_id: String(d.parent_id) }),
    ...(d.last_message_id != null && { last_message_id: String(d.last_message_id) }),
    ...(d.last_read_message_id != null && { last_read_message_id: String(d.last_read_message_id) }),
    ...(typeof d.mention_count === 'number' && { mention_count: d.mention_count }),
  };
}

/** The `thread` block of a thread room, or null when absent. */
function threadFromPayload(raw: unknown): ThreadInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  return {
    archived: t.archived === true,
    ...(typeof t.archived_at === 'string' ? { archived_at: t.archived_at } : {}),
    locked: t.locked === true,
    private: t.private === true,
    invitable: t.invitable !== false,
    auto_archive_minutes: typeof t.auto_archive_minutes === 'number' ? t.auto_archive_minutes : 1440,
    owner_id: t.owner_id != null ? String(t.owner_id) : '',
    ...(t.starter_message_id != null ? { starter_message_id: String(t.starter_message_id) } : {}),
    ...(typeof t.last_active_at === 'string' ? { last_active_at: t.last_active_at } : {}),
    message_count: typeof t.message_count === 'number' ? t.message_count : 0,
    member_count: typeof t.member_count === 'number' ? t.member_count : 0,
    joined: t.joined === true,
  };
}

/** Normalize a raw room record from any API response (same shape as READY space_rooms). */
export function spaceRoomFromPayload(d: Record<string, unknown>): SpaceRoom | null {
  return spaceRoomFromReady(d);
}

function upsertSpaceRoom(spaceId: string, room: SpaceRoom): void {
  setSpaces('spaceRoomsBySpaceId', spaceId, (list) => {
    const current = list ?? [];
    if (current.some((r) => r.id === room.id)) return current.map((r) => (r.id === room.id ? { ...r, ...room } : r));
    return [...current, room];
  });
}

/** Normalize a raw room record and put it in the store (a thread just created or fetched). */
export function upsertSpaceRoomFromPayload(spaceId: string, raw: Record<string, unknown>): SpaceRoom | null {
  const room = spaceRoomFromReady(raw);
  if (room) upsertSpaceRoom(spaceId, room);
  return room;
}

/** Keep a thread's message_count in step with messages arriving and going. */
export function bumpThreadMessageCount(roomId: string, delta: number): void {
  setSpaces('spaceRoomsBySpaceId', (bySpaceId) => {
    const next: Record<string, SpaceRoom[]> = {};
    let changed = false;
    for (const [sid, list] of Object.entries(bySpaceId)) {
      let listChanged = false;
      const updated = list.map((r) => {
        if (r.id !== roomId || !r.thread) return r;
        listChanged = true;
        return { ...r, thread: { ...r.thread, message_count: Math.max(0, r.thread.message_count + delta) } };
      });
      next[sid] = listChanged ? updated : list;
      changed = changed || listChanged;
    }
    return changed ? next : bySpaceId;
  });
}

// ---- realtime -------------------------------------------------------------------------------

/** Register Stargate handlers for space, room, role and override events. Call once on app init. */
export function initSpaceHandlers(): () => void {
  return onStargateEvent((event) => {
    const payload = (event.d as { d?: unknown })?.d ?? event.d;
    if (event.t === 'SPACE_CREATE' || event.t === 'SPACE_UPDATE') {
      const space = spaceFromPayload(payload);
      if (space) addOrUpdateSpace(space);
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    const d = payload as Record<string, unknown>;
    const spaceID =
      (d.space_id != null ? String(d.space_id) : null) ?? (event.space_id != null ? String(event.space_id) : null);
    if (event.t === 'SPACE_LEAVE' || event.t === 'SPACE_DELETE') {
      // SPACE_LEAVE is sent to our own user channel after kick, ban, or a self-leave from
      // another session - never broadcast to the space, so every device drops it in sync.
      // SPACE_DELETE goes to the whole space: the owner deleted it and it is gone for
      // everyone. Either way the space leaves local state; whoever is looking at it is
      // sent home by SpacePage's own "space disappeared" effect.
      if (spaceID) removeSpace(spaceID);
      return;
    }
    if (!spaceID) return;
    switch (event.t) {
      case 'SPACE_ROLE_CREATE':
      case 'SPACE_ROLE_UPDATE': {
        const role = roleFromPayload(d);
        if (role) upsertSpaceRole(spaceID, role);
        return;
      }
      case 'SPACE_ROLE_DELETE': {
        const roleId = d.role_id != null ? String(d.role_id) : null;
        if (roleId) removeSpaceRole(spaceID, roleId);
        return;
      }
      case 'SPACE_ROOM_CREATE': {
        // Other members' clients used to learn about a new channel only on reload.
        const room = spaceRoomFromReady(d);
        if (!room) return;
        setSpaces('spaceRoomsBySpaceId', spaceID, (list) => {
          const current = list ?? [];
          if (current.some((r) => r.id === room.id)) return current.map((r) => (r.id === room.id ? { ...r, ...room } : r));
          return [...current, room];
        });
        return;
      }
      case 'SPACE_ROOM_OVERRIDE_UPDATE': {
        const roomId = d.room_id != null ? String(d.room_id) : null;
        const o = overrideFromPayload(d);
        if (roomId && o) applyRoomRoleOverride(spaceID, roomId, o);
        return;
      }
      case 'SPACE_ROOM_OVERRIDE_DELETE': {
        const roomId = d.room_id != null ? String(d.room_id) : null;
        const roleId = d.role_id != null ? String(d.role_id) : null;
        if (roomId && roleId) removeRoomRoleOverride(spaceID, roomId, roleId);
        return;
      }
      case 'SPACE_ROOM_USER_OVERRIDE_UPDATE': {
        const roomId = d.room_id != null ? String(d.room_id) : null;
        const o = userOverrideFromPayload(d);
        if (roomId && o) applyRoomUserOverride(spaceID, roomId, o);
        return;
      }
      case 'SPACE_ROOM_USER_OVERRIDE_DELETE': {
        const roomId = d.room_id != null ? String(d.room_id) : null;
        const userId = d.user_id != null ? String(d.user_id) : null;
        if (roomId && userId) removeRoomUserOverride(spaceID, roomId, userId);
        return;
      }
      case 'SPACE_ROOM_UPDATE': {
        const roomID = d.room_id != null ? String(d.room_id) : null;
        if (!roomID) return;
        setSpaces('spaceRoomsBySpaceId', spaceID, (list) =>
          (list ?? []).map((r) =>
            r.id === roomID
              ? {
                  ...r,
                  ...(typeof d.name === 'string' ? { name: d.name } : {}),
                  ...(typeof d.topic === 'string' ? { topic: d.topic } : {}),
                  ...(typeof d.slowmode_seconds === 'number' ? { slowmode_seconds: d.slowmode_seconds } : {}),
                  ...(typeof d.e2ee_enabled === 'boolean' ? { e2ee_enabled: d.e2ee_enabled } : {}),
                  ...(typeof d.permissions_synced === 'boolean' ? { permissions_synced: d.permissions_synced } : {}),
                  ...(typeof d.user_limit === 'number' ? { user_limit: d.user_limit } : {}),
                  ...(typeof d.bitrate === 'number' ? { bitrate: d.bitrate } : {}),
                  ...(typeof d.position === 'number' ? { position: d.position } : {}),
                  ...(d.parent_id !== undefined
                    ? d.parent_id === null
                      ? { parent_id: undefined }
                      : { parent_id: String(d.parent_id as string | number) }
                    : {}),
                  ...(d.updated_at != null ? { updated_at: String(d.updated_at) } : {}),
                }
              : r
          )
        );
        return;
      }
      case 'SPACE_ROOM_DELETE': {
        const roomID = d.room_id != null ? String(d.room_id) : null;
        if (!roomID) return;
        setSpaces('spaceRoomsBySpaceId', spaceID, (list) => (list ?? []).filter((r) => r.id !== roomID));
        return;
      }
      // Threads (Discord's THREAD_* events): a thread is a room of type 6 in this same list.
      case 'THREAD_CREATE': {
        const room = spaceRoomFromReady(d);
        if (!room) return;
        // A fresh thread's broadcast carries the creator's view and nobody else is in it yet
        // (Discord's newly_created); a THREAD_CREATE sent to one person - on being added to
        // a private thread - already describes that person's own membership.
        if (room.thread && d.newly_created === true) {
          room.thread = { ...room.thread, joined: room.thread.owner_id === auth.user?.id };
        }
        upsertSpaceRoom(spaceID, room);
        return;
      }
      case 'THREAD_UPDATE': {
        const roomID = d.room_id != null ? String(d.room_id) : d.id != null ? String(d.id) : null;
        if (!roomID) return;
        const incoming = threadFromPayload(d.thread);
        patchRoom(spaceID, roomID, (r) => ({
          ...r,
          ...(typeof d.name === 'string' ? { name: d.name } : {}),
          ...(typeof d.slowmode_seconds === 'number' ? { slowmode_seconds: d.slowmode_seconds } : {}),
          // Membership is per viewer and does not ride on this broadcast: keep what we know.
          ...(incoming ? { thread: { ...incoming, joined: r.thread?.joined ?? false } } : {}),
          ...(d.updated_at != null ? { updated_at: String(d.updated_at) } : {}),
        }));
        return;
      }
      case 'THREAD_DELETE': {
        const roomID = d.room_id != null ? String(d.room_id) : null;
        if (!roomID) return;
        setSpaces('spaceRoomsBySpaceId', spaceID, (list) => (list ?? []).filter((r) => r.id !== roomID));
        return;
      }
      case 'THREAD_MEMBERS_UPDATE': {
        const roomID = d.room_id != null ? String(d.room_id) : null;
        if (!roomID) return;
        const me = auth.user?.id;
        const added = Array.isArray(d.added_members)
          ? (d.added_members as { user_id?: unknown }[]).map((m) => (m?.user_id != null ? String(m.user_id) : ''))
          : [];
        const removed = Array.isArray(d.removed_member_ids) ? (d.removed_member_ids as unknown[]).map((x) => String(x)) : [];
        const count = typeof d.member_count === 'number' ? d.member_count : undefined;
        patchRoom(spaceID, roomID, (r) =>
          r.thread
            ? {
                ...r,
                thread: {
                  ...r.thread,
                  ...(count !== undefined ? { member_count: count } : {}),
                  ...(me && added.includes(me) ? { joined: true } : {}),
                  ...(me && removed.includes(me) ? { joined: false } : {}),
                },
              }
            : r
        );
        return;
      }
      case 'THREAD_MEMBER_UPDATE': {
        const roomID = d.room_id != null ? String(d.room_id) : null;
        if (!roomID) return;
        const known = spaces.spaceRoomsBySpaceId[spaceID]?.some((r) => r.id === roomID);
        if (!known && d.joined === true) {
          // Joined a thread this client has never seen (added while offline, or a private one
          // whose THREAD_CREATE was missed): fetch it rather than patch nothing.
          void getThread(roomID)
            .then((raw) => upsertSpaceRoomFromPayload(spaceID, raw))
            .catch((err) => console.error('Loading joined thread failed:', err));
          return;
        }
        patchRoom(spaceID, roomID, (r) => (r.thread ? { ...r, thread: { ...r.thread, joined: d.joined === true } } : r));
        return;
      }
      default:
        return;
    }
  });
}

// ---- hydration -----------------------------------------------------------------------------

/** Hydrate spaces from READY payload (when backend includes spaces in READY). */
export function hydrateSpacesFromReady(spacesData: unknown[]): void {
  const list: Space[] = [];
  for (const item of spacesData) {
    const s = spaceFromPayload(item);
    if (s) list.push(s);
  }
  setSpaces({ spaces: list, loading: false, hydrated: true });
}

/** Hydrate space_rooms from READY payload (map of space_id -> room[]). */
export function hydrateSpaceRoomsFromReady(spaceRoomsData: Record<string, unknown[]>): void {
  const next: Record<string, SpaceRoom[]> = {};
  for (const [spaceId, arr] of Object.entries(spaceRoomsData)) {
    if (!Array.isArray(arr)) continue;
    const rooms: SpaceRoom[] = [];
    for (const item of arr) {
      if (item && typeof item === 'object') {
        const r = spaceRoomFromReady(item as Record<string, unknown>);
        if (r) {
          rooms.push(r);
          if (r.last_read_message_id != null || (r.mention_count ?? 0) > 0) {
            setReadStateFromRoom(
              r.id,
              { last_read_message_id: r.last_read_message_id, mention_count: r.mention_count },
              { authoritative: true }
            );
          }
        }
      }
    }
    next[spaceId] = rooms;
  }
  setSpaces('spaceRoomsBySpaceId', (prev) => ({ ...prev, ...next }));
}

/** Set space rooms for a space (e.g. after fetch or from READY). Also hydrates readState
 * (last_read_message_id/mention_count) per room - GET /spaces/:id/rooms carries these same
 * fields as the READY payload, and every UI mention/unread indicator reads from readState,
 * not from the room objects directly, so skipping this left them stuck at nothing-loaded
 * until a WS READY happened to hydrate the room by some other path. */
export function setSpaceRooms(spaceId: string, roomList: SpaceRoom[]): void {
  for (const r of roomList) {
    if (r.last_read_message_id != null || (r.mention_count ?? 0) > 0) {
      setReadStateFromRoom(
        r.id,
        { last_read_message_id: r.last_read_message_id, mention_count: r.mention_count },
        { authoritative: true }
      );
    }
  }
  setSpaces('spaceRoomsBySpaceId', (prev) => ({ ...prev, [spaceId]: roomList }));
}

const roomsInflight = new Map<string, Promise<void>>();

/** Re-fetch a space's room list from the server (after the caller changed it). Coalesces
 * concurrent calls for the same space into one request. */
export function refreshSpaceRooms(spaceId: string): Promise<void> {
  if (!spaceId) return Promise.resolve();
  const pending = roomsInflight.get(spaceId);
  if (pending) return pending;
  const p = getSpaceRooms(spaceId)
    .then((list) => setSpaceRooms(spaceId, list))
    .finally(() => roomsInflight.delete(spaceId));
  roomsInflight.set(spaceId, p);
  return p;
}

/** Fetch a space's rooms only when the store has none for it. */
export function ensureSpaceRooms(spaceId: string): Promise<void> {
  if (!spaceId || spaces.spaceRoomsBySpaceId[spaceId]?.length) return Promise.resolve();
  return refreshSpaceRooms(spaceId).catch(() => undefined);
}

/** Patch a space room's own mute/notify-mode fields across cached space room lists -
 * mirrors updateSpaceRoomLastMessage's cross-space lookup-by-id (the caller only has a
 * room id, not which space it belongs to). */
export function patchSpaceRoomNotifySettings(
  roomId: string,
  patch: { muted?: boolean; muted_until?: string | null; notify_mode?: number }
): void {
  setSpaces('spaceRoomsBySpaceId', (bySpaceId) => {
    const next: Record<string, SpaceRoom[]> = {};
    let changed = false;
    for (const [sid, list] of Object.entries(bySpaceId)) {
      let listChanged = false;
      const updated = list.map((r) => {
        if (r.id !== roomId) return r;
        listChanged = true;
        return {
          ...r,
          ...(patch.muted !== undefined ? { muted: patch.muted } : {}),
          ...(patch.muted_until !== undefined ? { muted_until: patch.muted_until ?? undefined } : {}),
          ...(patch.notify_mode !== undefined ? { notify_mode: patch.notify_mode } : {}),
        };
      });
      next[sid] = listChanged ? updated : list;
      changed = changed || listChanged;
    }
    return changed ? next : bySpaceId;
  });
}

/** Update a space room last_message_id across cached space room lists. */
export function updateSpaceRoomLastMessage(roomId: string, messageId: string): void {
  setSpaces('spaceRoomsBySpaceId', (bySpaceId) => {
    const next: Record<string, SpaceRoom[]> = {};
    let changed = false;
    for (const [sid, list] of Object.entries(bySpaceId)) {
      let listChanged = false;
      const updated = list.map((r) => {
        if (r.id !== roomId) return r;
        if (r.last_message_id === messageId) return r;
        listChanged = true;
        return {
          ...r,
          last_message_id: messageId,
          ...(r.thread ? { thread: { ...r.thread, message_count: r.thread.message_count + 1 } } : {}),
        };
      });
      next[sid] = listChanged ? updated : list;
      changed = changed || listChanged;
    }
    return changed ? next : bySpaceId;
  });
}

/** Set a space channel's last_message_id to an exact value or clear it (null). Used when a
 * deletion moves or removes the channel's newest message. */
export function setSpaceRoomLastMessageId(roomId: string, messageId: string | null): void {
  setSpaces('spaceRoomsBySpaceId', (bySpaceId) => {
    const next: Record<string, SpaceRoom[]> = {};
    let changed = false;
    for (const [sid, list] of Object.entries(bySpaceId)) {
      let listChanged = false;
      const updated = list.map((r) => {
        if (r.id !== roomId) return r;
        if ((r.last_message_id ?? null) === (messageId ?? null)) return r;
        listChanged = true;
        return { ...r, last_message_id: messageId ?? undefined };
      });
      next[sid] = listChanged ? updated : list;
      if (listChanged) changed = true;
    }
    return changed ? next : bySpaceId;
  });
}
