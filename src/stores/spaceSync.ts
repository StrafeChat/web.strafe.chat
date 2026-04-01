import { createStore } from 'solid-js/store';
import { onStargateEvent } from '../services/stargate/client';

/**
 * Revisions bumped by Stargate space events so createResource keys refetch
 * roles / room overrides without a full page reload.
 */
export const [spaceSync, setSpaceSync] = createStore({
  rolesRevision: {} as Record<string, number>,
  roomOverridesRevision: {} as Record<string, number>,
});

export function bumpSpaceRolesRevision(spaceId: string): void {
  if (!spaceId) return;
  setSpaceSync('rolesRevision', spaceId, (n) => (n ?? 0) + 1);
}

export function bumpRoomOverridesRevision(spaceId: string, roomId: string): void {
  if (!spaceId || !roomId) return;
  const k = `${spaceId}:${roomId}`;
  setSpaceSync('roomOverridesRevision', k, (n) => (n ?? 0) + 1);
}

/** Stargate EventPayload wraps business data in `.d`; normalize to a flat object. */
export function stargateEventInnerRecord(event: { d: unknown }): Record<string, unknown> | null {
  const outer = event.d as { d?: unknown } | null | undefined;
  const inner =
    outer && typeof outer === 'object' && outer !== null && 'd' in outer
      ? (outer as { d: unknown }).d
      : event.d;
  if (!inner || typeof inner !== 'object') return null;
  return inner as Record<string, unknown>;
}

/** SPACE_ROLE_*, SPACE_ROOM_OVERRIDE_* → bump local revision counters. */
export function initSpaceRealtimeHandlers(): () => void {
  return onStargateEvent((event) => {
    const t = event.t;
    if (
      t !== 'SPACE_ROLE_CREATE' &&
      t !== 'SPACE_ROLE_UPDATE' &&
      t !== 'SPACE_ROLE_DELETE' &&
      t !== 'SPACE_ROOM_OVERRIDE_UPDATE' &&
      t !== 'SPACE_ROOM_OVERRIDE_DELETE'
    ) {
      return;
    }
    const d = stargateEventInnerRecord(event);
    const spaceId =
      (d?.space_id != null ? String(d.space_id) : null) ??
      (event.space_id != null ? String(event.space_id) : null);
    if (!spaceId) return;

    if (t === 'SPACE_ROLE_CREATE' || t === 'SPACE_ROLE_UPDATE' || t === 'SPACE_ROLE_DELETE') {
      bumpSpaceRolesRevision(spaceId);
      return;
    }
    const roomId = d?.room_id != null ? String(d.room_id) : null;
    if (roomId) {
      bumpRoomOverridesRevision(spaceId, roomId);
    }
  });
}
