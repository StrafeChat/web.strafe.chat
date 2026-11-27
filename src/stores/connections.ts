import { createSignal } from 'solid-js';
import { getUserConnections } from '../api/connections';
import type { ShownConnection } from '../api/connections';
import { onStargateEvent } from '../services/stargate/client';
import { auth } from './auth';

/**
 * Connections on the client: a counter the settings page refetches on (USER_CONNECTIONS_UPDATE,
 * the account's own channel), a short per-user cache of what profiles show, and the result of
 * an OAuth round trip the /settings/connections landing route hands to the settings page.
 */

const [connectionsVersion, setConnectionsVersion] = createSignal(0);
export { connectionsVersion };

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; list: ShownConnection[] }>();
const inflight = new Map<string, Promise<ShownConnection[]>>();

/** What the signed-in account may see of a user's connections, cached for a minute. */
export function loadUserConnections(userId: string): Promise<ShownConnection[]> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.list);
  const pending = inflight.get(userId);
  if (pending) return pending;
  const p = getUserConnections(userId)
    .then((r) => {
      const list = Array.isArray(r.connections) ? r.connections : [];
      cache.set(userId, { at: Date.now(), list });
      return list;
    })
    .catch(() => [] as ShownConnection[])
    .finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

/** Forget a user's cached connections (one's own after a change). */
export function forgetUserConnections(userId: string): void {
  cache.delete(userId);
}

export function initConnectionsHandler(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'USER_CONNECTIONS_UPDATE') return;
    const self = auth.user?.id;
    if (self) forgetUserConnections(self);
    setConnectionsVersion((v) => v + 1);
  });
}

/** How an OAuth round trip ended (`?connected=` or `?error=` on /settings/connections). */
export interface ConnectionsCallbackResult {
  connected?: string;
  error?: string;
}

let pendingCallback: ConnectionsCallbackResult | null = null;

export function setConnectionsCallback(result: ConnectionsCallbackResult): void {
  pendingCallback = result;
}

/** Consumed on read. */
export function takeConnectionsCallback(): ConnectionsCallbackResult | null {
  const r = pendingCallback;
  pendingCallback = null;
  return r;
}
