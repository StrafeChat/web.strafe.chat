import { createStore } from 'solid-js/store';
import { listSpaces, type Space, type SpaceRoom } from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';

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
}

/** Add or update a single space (e.g. from SPACE_CREATE / SPACE_UPDATE). Idempotent. */
export function addOrUpdateSpace(space: Space): void {
  setSpaces('spaces', (list) => {
    const idx = list.findIndex((s) => s.id === space.id);
    if (idx >= 0) return list.map((s, i) => (i === idx ? space : s));
    return [...list, space];
  });
}

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
    ...(d.afk_room_id != null && { afk_room_id: String(d.afk_room_id) }),
    ...(d.system_room_id != null && { system_room_id: String(d.system_room_id) }),
    ...(d.rules_room_id != null && { rules_room_id: String(d.rules_room_id) }),
    ...(d.public_updates_room_id != null && { public_updates_room_id: String(d.public_updates_room_id) }),
    ...(d.everyone_role_id != null && { everyone_role_id: String(d.everyone_role_id) }),
  };
}

/** Register Stargate handlers for SPACE_CREATE and SPACE_UPDATE. Call once on app init. */
export function initSpaceHandlers(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'SPACE_CREATE' && event.t !== 'SPACE_UPDATE') return;
    const payload = (event.d as { d?: unknown })?.d ?? event.d;
    const space = spaceFromPayload(payload);
    if (space) addOrUpdateSpace(space);
  });
}

/** Hydrate spaces from READY payload (when backend includes spaces in READY). */
export function hydrateSpacesFromReady(spacesData: unknown[]): void {
  const list = spacesData as Space[];
  setSpaces({ spaces: list, loading: false, hydrated: true });
}

/** Normalize a raw room from READY space_rooms to SpaceRoom shape. */
function spaceRoomFromReady(d: Record<string, unknown>): SpaceRoom | null {
  const id = d.id != null ? String(d.id) : null;
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
  return {
    id,
    type: typeof d.type === 'number' ? d.type : 3,
    name: typeof d.name === 'string' ? d.name : '',
    topic: typeof d.topic === 'string' ? d.topic : undefined,
    position: typeof d.position === 'number' ? d.position : 0,
    created_at,
    updated_at,
    ...(d.space_id != null && { space_id: String(d.space_id) }),
    ...(d.parent_id != null && { parent_id: String(d.parent_id) }),
    ...(d.last_message_id != null && { last_message_id: String(d.last_message_id) }),
  };
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
        if (r) rooms.push(r);
      }
    }
    next[spaceId] = rooms;
  }
  setSpaces('spaceRoomsBySpaceId', (prev) => ({ ...prev, ...next }));
}

/** Set space rooms for a space (e.g. after fetch or from READY). */
export function setSpaceRooms(spaceId: string, roomList: SpaceRoom[]): void {
  setSpaces('spaceRoomsBySpaceId', (prev) => ({ ...prev, [spaceId]: roomList }));
}
