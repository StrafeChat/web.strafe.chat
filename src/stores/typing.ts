import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { onStargateEvent } from '../services/stargate/client';

/**
 * Typing indicators, following Discord's model: there is no "stopped typing" signal, so an
 * announcement simply expires, and the authoritative "they're done" event is the message
 * itself arriving.
 *
 * TTL is a little longer than the interval clients re-announce at (see TYPING_PING_MS in
 * the composer pages) so someone typing continuously never flickers in and out.
 */
const TYPING_TTL_MS = 10_000;

/**
 * A TYPING_START published just before a message can be delivered just after it - they
 * travel as two independent publishes. Without this, that late announcement re-adds the
 * sender and their indicator hangs around for the whole TTL after their message already
 * landed.
 */
const POST_MESSAGE_SUPPRESS_MS = 2_000;

export interface TypingEntry {
  /** When this user started typing (not refreshed by re-announcements), so the indicator
   * can list people in the order they started rather than in object-key order. */
  startedAt: number;
  expiresAt: number;
}

export interface TypingState {
  /** roomId -> userId -> entry */
  byRoom: Record<string, Record<string, TypingEntry>>;
}

export const [typing, setTyping] = createStore<TypingState>({ byRoom: {} });
/** Bumped on every change so time-based filtering re-runs. */
const [typingVersion, setTypingVersion] = createSignal(0);

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** roomId:userId -> when that user's message last arrived. */
const lastMessageAt = new Map<string, number>();

function timerKey(roomId: string, userId: string) {
  return `${roomId}:${userId}`;
}

function clearTimer(key: string) {
  const existing = expiryTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    expiryTimers.delete(key);
  }
}

/** Drops one user from a room. A Solid store setter given an object *merges* it, so a
 * "copy without this key" object can never remove anything - `produce` is what actually
 * deletes. Getting this wrong is what made indicators outlive the message that ended them. */
function dropTyping(roomId: string, userId: string) {
  setTyping(
    produce((s) => {
      const room = s.byRoom[roomId];
      if (!room || !(userId in room)) return;
      delete room[userId];
      if (Object.keys(room).length === 0) delete s.byRoom[roomId];
    })
  );
  setTypingVersion((v) => v + 1);
}

function scheduleExpiry(roomId: string, userId: string) {
  const key = timerKey(roomId, userId);
  clearTimer(key);
  expiryTimers.set(
    key,
    setTimeout(() => {
      expiryTimers.delete(key);
      dropTyping(roomId, userId);
    }, TYPING_TTL_MS)
  );
}

/** Add a typing user, or extend their announcement. */
export function addTyping(roomId: string, userId: string) {
  const rid = String(roomId);
  const uid = String(userId);
  const now = Date.now();
  const sentAt = lastMessageAt.get(timerKey(rid, uid));
  if (sentAt !== undefined && now - sentAt < POST_MESSAGE_SUPPRESS_MS) return;
  setTyping(
    produce((s) => {
      const room = (s.byRoom[rid] ??= {});
      const existing = room[uid];
      room[uid] = { startedAt: existing?.startedAt ?? now, expiresAt: now + TYPING_TTL_MS };
    })
  );
  setTypingVersion((v) => v + 1);
  scheduleExpiry(rid, uid);
}

/** Remove a typing user - their message arrived, or they're the local user who just sent. */
export function removeTyping(roomId: string, userId: string) {
  const rid = String(roomId);
  const uid = String(userId);
  const key = timerKey(rid, uid);
  clearTimer(key);
  lastMessageAt.set(key, Date.now());
  dropTyping(rid, uid);
}

export { typingVersion };

/** Typing user IDs for a room, oldest first, excluding expired entries and one user
 * (normally yourself - you never need telling that you are typing). */
export function getTypingUserIds(roomId: string, excludeUserId?: string): string[] {
  typingVersion();
  const now = Date.now();
  const room = typing.byRoom[roomId];
  if (!room) return [];
  return Object.entries(room)
    .filter(([uid, entry]) => entry.expiresAt > now && uid !== excludeUserId)
    .sort((a, b) => a[1].startedAt - b[1].startedAt)
    .map(([uid]) => uid);
}

/** Fallback sweep for entries whose timer was lost (e.g. a backgrounded tab throttling timeouts). */
function pruneExpired() {
  const now = Date.now();
  let changed = false;
  setTyping(
    produce((s) => {
      for (const roomId of Object.keys(s.byRoom)) {
        const room = s.byRoom[roomId];
        if (!room) continue;
        for (const [uid, entry] of Object.entries(room)) {
          if (entry.expiresAt > now) continue;
          delete room[uid];
          clearTimer(timerKey(roomId, uid));
          changed = true;
        }
        if (Object.keys(room).length === 0) delete s.byRoom[roomId];
      }
    })
  );
  if (changed) setTypingVersion((v) => v + 1);
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
      const data =
        inner && typeof inner === 'object' && !Array.isArray(inner)
          ? (inner as Record<string, unknown>)
          : serverEvt ?? {};
      const roomId = String(
        data?.room_id ?? (evt as { room_id?: string }).room_id ?? (evt as { space_id?: string }).space_id ?? ''
      ).trim();
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
