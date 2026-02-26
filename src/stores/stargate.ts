/**
 * Stargate WebSocket connection store
 */

import type { ConnectionStatus } from '../types/stargate';
import { createStore } from 'solid-js/store';

export interface StargateState {
  status: ConnectionStatus;
  ready: boolean;
  lastEventAt: number | null;
  error: string | null;
}

export const [stargate, setStargate] = createStore<StargateState>({
  status: 'idle',
  ready: false,
  lastEventAt: null,
  error: null,
});

export function setStargateStatus(status: ConnectionStatus, error?: string) {
  setStargate({ status, error: error ?? null });
}

/** Ready payload from server (user, rooms, relationships). */
export let lastReadyPayload: unknown = null;

export function setStargateReady(ready: boolean, payload?: unknown) {
  if (payload != null) lastReadyPayload = payload;
  setStargate('ready', ready);
}

export function setStargateLastEvent() {
  setStargate('lastEventAt', Date.now());
}
