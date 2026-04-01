import { createStore } from 'solid-js/store';
import type { RoomParticipant } from '../api/rooms';
import { listSpaceMembers } from '../api/spaces';
import { onStargateEvent } from '../services/stargate/client';
import { stargateEventInnerRecord } from './spaceSync';

export interface SpaceMembersState {
  bySpaceId: Record<string, RoomParticipant[]>;
  loading: Record<string, boolean>;
}

export const [spaceMembers, setSpaceMembers] = createStore<SpaceMembersState>({
  bySpaceId: {},
  loading: {},
});

export async function loadSpaceMembers(spaceId: string): Promise<void> {
  if (!spaceId) return;
  setSpaceMembers('loading', spaceId, true);
  try {
    const list = await listSpaceMembers(spaceId);
    setSpaceMembers('bySpaceId', spaceId, list);
  } finally {
    setSpaceMembers('loading', spaceId, false);
  }
}

export function upsertSpaceMember(spaceId: string, member: RoomParticipant): void {
  if (!spaceId || !member.id) return;
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
      const d = stargateEventInnerRecord(event);
      const spaceId =
        (d?.space_id != null ? String(d.space_id) : null) ??
        (event.space_id != null ? String(event.space_id) : null);
      if (spaceId) {
        loadSpaceMembers(spaceId).catch(() => {});
      }
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
      const member: RoomParticipant & { roles?: string[] } = {
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
        presence:
          d.presence && typeof d.presence === 'object'
            ? (d.presence as import('../api/relationships').UserPresence)
            : undefined,
        ...(roles ? { roles } : {}),
      };
      upsertSpaceMember(spaceId, member);
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

