import { createSignal } from 'solid-js';

/**
 * A one-shot request to open a space's Invite or Settings modal, made from the server rail's
 * right-click menu but owned by that space's SpaceRoomsBar (which holds those modals). The rail
 * sets it and navigates to the space if needed; the space's SpaceRoomsBar consumes it on mount.
 */
export type SpaceQuickAction = 'invite' | 'settings';

const [pendingSpaceAction, setPendingSpaceAction] = createSignal<{ spaceId: string; action: SpaceQuickAction } | null>(
  null
);

export { pendingSpaceAction };

export function requestSpaceAction(spaceId: string, action: SpaceQuickAction): void {
  setPendingSpaceAction({ spaceId, action });
}

/** If a request is pending for this space, return its action and clear it; otherwise null. */
export function consumeSpaceAction(spaceId: string): SpaceQuickAction | null {
  const p = pendingSpaceAction();
  if (p && p.spaceId === spaceId) {
    setPendingSpaceAction(null);
    return p.action;
  }
  return null;
}
