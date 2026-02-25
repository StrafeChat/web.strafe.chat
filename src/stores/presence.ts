/**
 * Presence handler – listens for PRESENCE_UPDATE WebSocket events and updates the relationships store.
 */

import { onStargateEvent } from '../services/stargate/client';
import { updatePresence } from './relationships';

export function initPresenceHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'PRESENCE_UPDATE') return;

    // event.d is the full EventPayload; payload is in event.d.d (Data field)
    const payload = (event.d as { d?: { user_id?: string; presence?: { online?: boolean } } })
      ?.d;
    const userId = payload?.user_id;
    const online = payload?.presence?.online;

    if (userId != null && typeof online === 'boolean') {
      updatePresence(userId, online);
    }
  });
}
