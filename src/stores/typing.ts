import { createStore } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { onStargateEvent } from '../services/stargate/client';

const TYPING_TTL_MS = 8_000;

export interface TypingState {
  /** roomId -> userId -> expiry timestamp */
  byRoom: Record<string, Record<string, number>>;
}

export const [typing, setTyping] = createStore<TypingState>({ byRoom: {} });
/** Bump to force reactivity when store updates may not trigger */
const [typingVersion, setTypingVersion] = createSignal(0);

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(roomId: string, userId: string) {
  return `${roomId}:${userId}`;
}

function scheduleExpiry(roomId: string, userId: string) {
  const key = timerKey(roomId, userId);
  const existing = expiryTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    expiryTimers.delete(key);
    setTyping('byRoom', roomId, (prev) => {
      const next = { ...(prev ?? {}) };
      delete next[userId];
      return next;
    });
    setTypingVersion((v) => v + 1);
  }, TYPING_TTL_MS);
  expiryTimers.set(key, timer);
}

/** Add typing user. Resets TTL on repeat event. */
export function addTyping(roomId: string, userId: string) {
  const rid = String(roomId);
  const uid = String(userId);
  const expiry = Date.now() + TYPING_TTL_MS;
  setTyping('byRoom', rid, (prev) => ({
    ...(prev ?? {}),
    [uid]: expiry,
  }));
  setTypingVersion((v) => v + 1);
  scheduleExpiry(rid, uid);
}

/** Remove typing user (e.g. on message send). */
export function removeTyping(roomId: string, userId: string) {
  const rid = String(roomId);
  const uid = String(userId);
  const key = timerKey(rid, uid);
  const timer = expiryTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(key);
  }
  setTyping('byRoom', rid, (p) => {
    const next = { ...(p ?? {}) };
    delete next[uid];
    return next;
  });
  setTypingVersion((v) => v + 1);
}

export { typingVersion };

/** Get typing user IDs for room (excluding current user, only non-expired). */
export function getTypingUserIds(roomId: string, excludeUserId?: string): string[] {
  const now = Date.now();
  const room = typing.byRoom[roomId];
  if (!room) return [];
  return Object.entries(room)
    .filter(([uid, exp]) => exp > now && uid !== excludeUserId)
    .map(([uid]) => uid);
}

/** Prune expired entries. Called periodically as fallback. */
function pruneExpired() {
  const now = Date.now();
  for (const roomId of Object.keys(typing.byRoom)) {
    const room = typing.byRoom[roomId];
    if (!room) continue;
    let changed = false;
    const next = { ...room };
    for (const [uid, exp] of Object.entries(room)) {
      if (exp <= now) {
        delete next[uid];
        changed = true;
        const key = timerKey(roomId, uid);
        const t = expiryTimers.get(key);
        if (t) {
          clearTimeout(t);
          expiryTimers.delete(key);
        }
      }
    }
    if (changed) {
      setTyping('byRoom', roomId, next);
      setTypingVersion((v) => v + 1);
    }
  }
}

/** Register TYPING_START and MESSAGE_CREATE handlers. Call once on app init. */
export function initTypingHandler() {
  const pruneInterval = setInterval(pruneExpired, 1_000);
  const unsub = onStargateEvent((evt) => {
    if (evt.t === 'TYPING_START') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = (data?.room_id ?? (evt as { room_id?: string }).room_id) as string | undefined;
      const userId = data?.user_id as string | undefined;
      if (roomId && userId) addTyping(roomId, userId);
    } else if (evt.t === 'MESSAGE_CREATE') {
      const serverEvt = evt.d as Record<string, unknown> | undefined;
      const inner = serverEvt?.d ?? serverEvt;
      const data = (inner && typeof inner === 'object' && !Array.isArray(inner))
        ? (inner as Record<string, unknown>)
        : (serverEvt ?? {});
      const roomId = String(data?.room_id ?? (evt as { room_id?: string }).room_id ?? (evt as { space_id?: string }).space_id ?? '').trim();
      const senderId = String(data?.sender_id ?? data?.user_id ?? '').trim();
      if (roomId && senderId && roomId !== 'undefined' && senderId !== 'undefined') {
        removeTyping(roomId, senderId);
      }
    }
  });
  return () => {
    clearInterval(pruneInterval);
    unsub();
  };
}
