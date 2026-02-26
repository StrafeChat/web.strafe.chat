/**
 * Stargate WebSocket client – connects when authenticated, handles reconnection.
 */

import { Op } from '../../types/stargate';
import { setStargate, setStargateStatus, setStargateReady, setStargateLastEvent } from '../../stores/stargate';

const DEFAULT_URL = 'ws://localhost:4001/events';

type EventHandler = (event: { t: string; space_id?: string; room_id?: string; user_id?: string; d: unknown }) => void;
const eventHandlers = new Set<EventHandler>();

type ReadyHandler = (payload: ReadyPayload) => void;
let readyHandler: ReadyHandler | null = null;

export interface ReadyPayload {
  user?: { id: string; username: string; discriminator: number | string; display_name: string };
  session_id?: string;
  rooms?: unknown[];
  relationships?: unknown[];
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

function getUrl(token: string): string {
  const base = import.meta.env.VITE_STARGATE_URL ?? DEFAULT_URL;
  const url = new URL(base.replace(/^ws/, 'http'));
  url.searchParams.set('token', token);
  return url.toString().replace(/^http/, 'ws');
}

export function connectStargate(token: string): void {
  activeToken = token;
  if (ws?.readyState === WebSocket.OPEN) return;
  if (ws) ws.close();
  ws = null;

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
    try {
      const msg = JSON.parse(event.data) as { op: number; d?: unknown; t?: string };
      switch (msg.op) {
        case Op.Ready:
          const ready = msg.d as ReadyPayload;
          setStargateReady(true, ready);
          try {
            readyHandler?.(ready);
          } catch (e) {
            console.error('Stargate ready handler error:', e);
          }
          break;
        case Op.Event:
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
        case Op.Pong:
          break;
        case Op.Error:
          const err = msg.d as { code?: number; message?: string };
          setStargateStatus('failed', err?.message ?? 'Unknown error');
          break;
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

export function disconnectStargate(): void {
  activeToken = null;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;
  if (ws) {
    ws.close();
    ws = null;
  }
  setStargateStatus('idle');
  setStargateReady(false);
}

export function subscribe(spaceId?: string, userId?: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ op: Op.Subscribe, d: { space_id: spaceId, user_id: userId } }));
}

export function unsubscribe(spaceId?: string, userId?: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ op: 5, d: { space_id: spaceId, user_id: userId } }));
}

export function send(spaceId: string, type: string, content: unknown, replyTo?: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ op: Op.Send, d: { space_id: spaceId, type, content, reply_to: replyTo } }));
}
