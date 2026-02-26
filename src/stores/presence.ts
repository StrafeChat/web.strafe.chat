/**
 * Presence handler – listens for PRESENCE_UPDATE WebSocket events and updates
 * both the relationships store (for friends list) and a global presence map
 * so any part of the app can show real-time online status.
 */

import { createStore } from 'solid-js/store';
import { onStargateEvent } from '../services/stargate/client';
import { updatePresence } from './relationships';

export interface UserPresence {
  status: 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';
  custom_status?: string;
}

export interface PresenceState {
  /** user_id -> presence (status + custom_status). undefined = unknown. */
  byUser: Record<string, UserPresence>;
}

export const [presence, setPresence] = createStore<PresenceState>({
  byUser: {},
});

/** Update a user's presence. Called from PRESENCE_UPDATE handler. */
export function setUserPresence(userId: string, p: UserPresence): void {
  setPresence('byUser', userId, p);
}

/** True if status indicates user is "visible" (online or idle). */
export function isVisibleStatus(status: string | undefined): boolean {
  return status === 'online' || status === 'idle';
}

export function initPresenceHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'PRESENCE_UPDATE') return;

    const payload = (event.d as {
      d?: { user_id?: string; presence?: { status?: string; custom_status?: string } };
    })?.d;
    const userId = payload?.user_id;
    const p = payload?.presence;

    if (userId != null && p?.status) {
      const valid = ['online', 'idle', 'dnd', 'offline', 'invisible'].includes(p.status);
      if (valid) {
        const presence: UserPresence = {
          status: p.status as UserPresence['status'],
          custom_status: p.custom_status,
        };
        setUserPresence(userId, presence);
        updatePresence(userId, presence);
      }
    }
  });
}
