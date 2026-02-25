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

export function setStargateReady(ready: boolean) {
  setStargate('ready', ready);
}

export function setStargateLastEvent() {
  setStargate('lastEventAt', Date.now());
}
