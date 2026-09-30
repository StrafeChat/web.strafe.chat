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
} from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';
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
  setSpaces('spaces', (list) => list.filter((s) => s.id !== spaceId));
  // `produce`, not a spread copy: a store setter handed a plain object *merges* it, so
  // "everything except this key" quietly leaves the space's room list cached forever.
  setSpaces(
    produce((s) => {
      delete s.spaceRoomsBySpaceId[spaceId];
    })
  );
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
    verification_level: typeof d.verification_level === 'number' ? d.verification_level : 0,
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
    ...(d.rules_room_id != null && { rules_room_id: String(d.rules_room_id) }),
    ...(d.public_updates_room_id != null && { public_updates_room_id: String(d.public_updates_room_id) }),
    ...(d.everyone_role_id != null && { everyone_role_id: String(d.everyone_role_id) }),
    ...(roles ? { roles } : {}),
  };
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
  return {
    id,
    type: typeof d.type === 'number' ? d.type : 3,
    name: typeof d.name === 'string' ? d.name : '',
    topic: typeof d.topic === 'string' ? d.topic : undefined,
    position: typeof d.position === 'number' ? d.position : 0,
    ...(typeof d.slowmode_seconds === 'number' && { slowmode_seconds: d.slowmode_seconds }),
    ...(typeof d.e2ee_enabled === 'boolean' && { e2ee_enabled: d.e2ee_enabled }),
    ...(typeof d.user_limit === 'number' && { user_limit: d.user_limit }),
    ...(typeof d.bitrate === 'number' && { bitrate: d.bitrate }),
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
        return { ...r, last_message_id: messageId };
      });
      next[sid] = listChanged ? updated : list;
      changed = changed || listChanged;
    }
    return changed ? next : bySpaceId;
  });
}
