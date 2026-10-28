/**
 * Stargate WebSocket client – connects when authenticated, handles reconnection.
 */

import { Op } from '../../types/stargate';
import { setStargateStatus, setStargateReady, setStargateLastEvent } from '../../stores/stargate';
import { stargateUrl } from '../../lib/runtimeConfig';

type EventHandler = (event: { t: string; space_id?: string; room_id?: string; user_id?: string; d: unknown }) => void;
const eventHandlers = new Set<EventHandler>();

type ReadyHandler = (payload: ReadyPayload) => void;
let readyHandler: ReadyHandler | null = null;

export interface ReadyPayload {
  user?: { id: string; username: string; discriminator: number | string; display_name: string };
  session_id?: string;
  rooms?: unknown[];
  relationships?: unknown[];
  spaces?: unknown[];
  space_rooms?: Record<string, unknown[]>;
  voice_states?: unknown[];
  calls?: unknown[];
}

export function onStargateReady(handler: ReadyHandler): () => void {
  readyHandler = handler;
  return () => { readyHandler = null; };
}

export function onStargateEvent(handler: EventHandler): () => void {
  eventHandlers.add(handler);
  return () => eventHandlers.delete(handler);
}

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let activeToken: string | null = null;
// Wall-clock of the last inbound frame and of when the tab was last hidden - used by the
// wake handler to tell a live socket from one a backgrounded mobile browser silently killed.
let lastMessageAt = 0;
let hiddenAt = 0;

// Reference-counted: multiple independent callers can each want the same channel
// subscribed (e.g. a room's own page view AND a blanket "every channel in this space"
// effect for sidebar/badge purposes) without one's cleanup silently dropping the other's
// subscription. Only the 0->1 transition sends Subscribe; only 1->0 sends Unsubscribe.
const subRefCounts = new Map<string, number>();

/** Between the two ids in a key: neither id can contain it. resubscribeAll splits on it too. */
const SUB_KEY_SEP = '\u0000';

function subKey(spaceId?: string, userId?: string): string {
  return `${spaceId ?? ''}${SUB_KEY_SEP}${userId ?? ''}`;
}

function getUrl(token: string): string {
  const base = stargateUrl();
  const url = new URL(base.replace(/^ws/, 'http'));
  // A base URL with no path at all (e.g. "ws://localhost:4001") would silently hit
  // the server's root instead of /events and never connect - default the path only
  // when the configured base didn't specify one; custom deployment paths are left as-is.
  if (url.pathname === '' || url.pathname === '/') {
    url.pathname = '/events';
  }
  url.searchParams.set('token', token);
  return url.toString().replace(/^http/, 'ws');
}

/** Detach handlers from a superseded socket so its delayed close/error events can't
 * mutate state for the connection that replaced it (e.g. null out a live `ws`). */
function detachSocket(sock: WebSocket | null): void {
  if (!sock) return;
  sock.onopen = null;
  sock.onmessage = null;
  sock.onclose = null;
  sock.onerror = null;
}

export function connectStargate(token: string): void {
  activeToken = token;
  if (ws?.readyState === WebSocket.OPEN) return;
  if (ws) {
    detachSocket(ws);
    ws.close();
  }
  ws = null;
  // A new connection starts with zero subscriptions server-side, regardless of what this
  // client previously thought it had subscribed to - clear so the next round of
  // subscribe() calls (effects re-running as `ready` flips back true) actually re-sends
  // Subscribe instead of treating it as an already-satisfied duplicate.
  subRefCounts.clear();

  const url = getUrl(token);
  setStargateStatus('connecting');

  try {
    ws = new WebSocket(url);
  } catch (err) {
    setStargateStatus('failed', err instanceof Error ? err.message : 'Failed to connect');
    scheduleReconnect(token);
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    setStargateStatus('connected');
  };

  ws.onmessage = (event) => {
    lastMessageAt = Date.now();
    try {
      const msg = JSON.parse(event.data) as { op: number; d?: unknown; t?: string };
      switch (msg.op) {
        case Op.Ready: {
          const ready = msg.d as ReadyPayload;
          setStargateReady(true, ready);
          try {
            readyHandler?.(ready);
          } catch (e) {
            console.error('Stargate ready handler error:', e);
          }
          break;
        }
        case Op.Event: {
          setStargateLastEvent();
          const evt = msg.d as { t?: string; space_id?: string; room_id?: string; user_id?: string; d?: unknown };
          const eventType = evt?.t ?? (msg as { t?: string }).t;
          if (eventType) {
            for (const h of eventHandlers) {
              try {
                h({
                  t: typeof eventType === 'string' ? eventType : 'UNKNOWN',
                  space_id: evt?.space_id,
                  room_id: evt?.room_id ?? evt?.space_id,
                  user_id: evt?.user_id,
                  d: evt,
                });
              } catch (e) {
                console.error('Stargate event handler error:', e);
              }
            }
          }
          break;
        }
        case Op.Pong:
          break;
        case Op.Error: {
          // A per-request error frame (e.g. 4403 when a subscribe is refused for a
          // channel this account may not view) is NOT a connection failure - the socket
          // is still open and every other channel keeps working. Setting the status to
          // 'failed' here was what flashed a false "reconnecting" banner over a healthy
          // connection; just log it and carry on. Fatal problems (bad token) arrive as a
          // close frame, handled by onclose.
          const err = msg.d as { code?: number; message?: string };
          console.warn('Stargate error frame:', err?.code, err?.message);
          break;
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    ws = null;
    setStargateReady(false);
    if (activeToken === token) {
      setStargateStatus('reconnecting');
      scheduleReconnect(token);
    }
  };

  ws.onerror = () => {
    // onclose will run after onerror
  };
}

function scheduleReconnect(token: string) {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectAttempts += 1;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (activeToken === token) connectStargate(token);
  }, delay);
}

function socketOpen(): boolean {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

/** Tear the current socket down and connect again immediately, bypassing the backoff.
 * Used when we come back to a dead/zombie connection - the fresh READY re-pulls state. */
function reconnectNow(): void {
  const token = activeToken;
  if (!token) return;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
  if (ws) {
    detachSocket(ws);
    try {
      ws.close();
    } catch {
      /* already closing */
    }
    ws = null;
  }
  setStargateReady(false);
  connectStargate(token);
}

/**
 * Called when the tab becomes visible again, regains focus, or the network returns. Mobile
 * browsers suspend or silently kill the WebSocket when the app is backgrounded, and the
 * `onclose` may never fire, so the page keeps rendering stale data. If the socket is gone we
 * reconnect at once (no 30s backoff wait); if it still claims OPEN we ping and, when the tab
 * had been hidden a while with no reply, force a fresh connection so state re-syncs via READY.
 */
function wakeSync(hiddenMs: number): void {
  if (!activeToken) return;
  if (!socketOpen()) {
    if (ws?.readyState === WebSocket.CONNECTING) return;
    reconnectNow();
    return;
  }
  const before = lastMessageAt;
  try {
    ws!.send(JSON.stringify({ op: Op.Ping }));
  } catch {
    reconnectNow();
    return;
  }
  // A brief desktop tab-switch shouldn't churn the connection; only verify (and force a
  // reconnect on silence) after a longer background, which is the case that goes stale.
  if (hiddenMs < 8000) return;
  setTimeout(() => {
    if (activeToken && socketOpen() && lastMessageAt <= before) reconnectNow();
  }, 4000);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    wakeSync(hiddenAt ? Date.now() - hiddenAt : 0);
    hiddenAt = 0;
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => wakeSync(Infinity));
  window.addEventListener('focus', () => wakeSync(0));
}

export function disconnectStargate(): void {
  activeToken = null;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
  if (ws) {
    detachSocket(ws);
    ws.close();
    ws = null;
  }
  setStargateStatus('idle');
  setStargateReady(false);
}

export function subscribe(spaceId?: string, userId?: string): void {
  const key = subKey(spaceId, userId);
  const next = (subRefCounts.get(key) ?? 0) + 1;
  subRefCounts.set(key, next);
  if (next > 1) return; // already subscribed on the server for some other caller
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ op: Op.Subscribe, d: { space_id: spaceId, user_id: userId } }));
}

/** One entry of `op 9`: the game this connection reports. */
export interface ActivityReport {
  type: 'playing';
  name: string;
  /** Unix ms the game started; 0 or absent means now. */
  started_at?: number;
}

/**
 * Report what the user is playing on this connection (`op 9`); null clears it. The report
 * belongs to the socket: the server forgets it when the connection goes, and a new socket
 * starts with none, so the caller sends it again after every READY. False when there is no
 * open socket to send it on. The server takes at most one entry, a burst of five reports and
 * then one every 12 s (it applies the latest when a token frees, without an error), and
 * answers a malformed one with error 4007.
 */
export function sendActivity(activities: ActivityReport[] | null): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify({ op: Op.Activity, d: { activities: activities ?? [] } }));
    return true;
  } catch {
    return false;
  }
}

export function unsubscribe(spaceId?: string, userId?: string): void {
  const key = subKey(spaceId, userId);
  const current = subRefCounts.get(key) ?? 0;
  const next = Math.max(0, current - 1);
  if (next > 0) {
    subRefCounts.set(key, next);
    return; // still wanted by another caller
  }
  subRefCounts.delete(key);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ op: Op.Unsubscribe, d: { space_id: spaceId, user_id: userId } }));
}

/**
 * Re-send a Subscribe frame for every channel this client currently wants (the whole
 * ref-counted set), without touching the counts. The gateway skips (dedupes) any it already
 * has, so this is cheap - its purpose is to re-assert the ones it does NOT have, which happens
 * right after joining a space: the gateway can briefly reject those subscribes because the new
 * membership isn't visible to its authorization read yet, and a rejected subscribe is otherwise
 * never retried (the account only recovered on a full reconnect). Called a couple of times after
 * a join to ride out that window. Safe to call anytime; a no-op when the socket is closed.
 */
export function resubscribeAll(): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  for (const key of subRefCounts.keys()) {
    // Split where subKey joined. Splitting on a space (as this once did) found none, so every
    // channel went out again as a bogus user subscription the gateway refused.
    const sep = key.indexOf(SUB_KEY_SEP);
    const spaceId = key.slice(0, sep);
    const userId = key.slice(sep + 1);
    ws.send(
      JSON.stringify({ op: Op.Subscribe, d: { space_id: spaceId || undefined, user_id: userId || undefined } })
    );
  }
}
