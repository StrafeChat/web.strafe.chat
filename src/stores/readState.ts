import { createStore } from 'solid-js/store';
import { onStargateEvent } from '../services/stargate/client';
import { ackRoom } from '../api/rooms';

export interface RoomReadState {
  lastReadMessageId: string | null;
  mentionCount: number;
}

export interface ReadStateStore {
  byRoom: Record<string, RoomReadState>;
}

export const [readState, setReadState] = createStore<ReadStateStore>({
  byRoom: {},
});

/**
 * Optimistically advances the read cursor to messageId and clears the mention badge, then
 * persists via ackRoom - rolling local state back to what it was if the request fails, so a
 * network hiccup can't leave the client believing a room is read when the server disagrees
 * (previously the optimistic write was never reverted; the mismatch only surfaced as an
 * unexplained badge reappearing on the next full reload).
 */
export function ackRoomOptimistic(roomId: string, messageId: string): void {
  const previous = readState.byRoom[roomId];
  setReadState('byRoom', roomId, { lastReadMessageId: messageId, mentionCount: 0 });
  ackRoom(roomId, messageId)
    .then(() => {
      // Re-assert on success: an authoritative snapshot (REST room list, reconnect READY)
      // that raced this request could have landed with the pre-ack cursor in between.
      const cur = readState.byRoom[roomId];
      if (!cur || messageIdGt(messageId, cur.lastReadMessageId ?? '0')) {
        setReadState('byRoom', roomId, { lastReadMessageId: messageId, mentionCount: 0 });
      }
    })
    .catch(() => {
      setReadState('byRoom', roomId, previous ?? { lastReadMessageId: null, mentionCount: 0 });
    });
}

/** Returns true if a is a valid snowflake (numeric string) and a > b. Temp IDs are skipped. */
function isSnowflake(id: string): boolean {
  return /^\d+$/.test(id);
}

export function compareMessageIds(a: string, b: string): number {
  if (!isSnowflake(a) || !isSnowflake(b)) return 0;
  try {
    const na = BigInt(a);
    const nb = BigInt(b);
    if (na > nb) return 1;
    if (na < nb) return -1;
    return 0;
  } catch {
    return 0;
  }
}

export function messageIdGt(a: string, b: string): boolean {
  return compareMessageIds(a, b) > 0;
}

export interface ReadStateSource {
  last_read_message_id?: string | null;
  mention_count?: number;
}

/**
 * Sync read state from a room object.
 *
 * - `authoritative` (READY payload, REST room listings): the server's word is final - set
 *   exactly what it says.
 * - default (room objects handed around the client: ROOM_CREATE/ROOM_UPDATE payloads, a
 *   fresh GET of one room, the space page's local SpaceRoom -> Room conversion): merge only.
 *   The read cursor may advance but never move backwards, and the mention badge is only
 *   replaced when the cursor actually advanced (a newer cursor means whatever produced it
 *   also cleared mentions). Fields the object doesn't carry are left untouched.
 *
 * Every caller used to overwrite unconditionally. That meant any stale copy of a room -
 * the page-load snapshot kept in spaces.spaceRoomsBySpaceId, or a ROOM_UPDATE with no read
 * fields at all - silently rewound the cursor to null or to its page-load value, which is
 * what resurrected the NEW divider, the unread banner and the sidebar dot every time a
 * space channel was re-entered (or, worse, on every incoming message while viewing it).
 */
export function setReadStateFromRoom(
  roomId: string,
  room: ReadStateSource,
  opts?: { authoritative?: boolean }
): void {
  const incomingRead = room.last_read_message_id ?? null;
  const incomingMentions = room.mention_count;
  if (opts?.authoritative) {
    setReadState('byRoom', roomId, {
      lastReadMessageId: incomingRead,
      mentionCount: incomingMentions ?? 0,
    });
    return;
  }
  const current = readState.byRoom[roomId];
  if (!current) {
    // First information we have for this room - take it as-is (nothing to regress from).
    if (incomingRead == null && incomingMentions == null) return;
    setReadState('byRoom', roomId, {
      lastReadMessageId: incomingRead,
      mentionCount: incomingMentions ?? 0,
    });
    return;
  }
  if (incomingRead != null && messageIdGt(incomingRead, current.lastReadMessageId ?? '0')) {
    setReadState('byRoom', roomId, {
      lastReadMessageId: incomingRead,
      mentionCount: incomingMentions ?? 0,
    });
  }
}

/** Update last read from MESSAGE_ACK event. */
export function ackRoomFromEvent(roomId: string, lastReadMessageId: string) {
  const current = readState.byRoom[roomId];
  const currentId = current?.lastReadMessageId;
  if (messageIdGt(lastReadMessageId, currentId ?? '0')) {
    setReadState('byRoom', roomId, {
      lastReadMessageId,
      mentionCount: 0,
    });
  }
}

/** Compute unread count: messages from others with id > lastReadMessageId. Excludes temp and own messages. */
export function getUnreadCount(
  roomId: string,
  messages: Array<{ id: string; sender_id: string }>,
  currentUserId: string
): number {
  const state = readState.byRoom[roomId];
  const lastRead = state?.lastReadMessageId ?? null;
  if (!lastRead) {
    return messages.filter((m) => m.sender_id !== currentUserId && isSnowflake(m.id)).length;
  }
  return messages.filter(
    (m) =>
      m.sender_id !== currentUserId &&
      isSnowflake(m.id) &&
      messageIdGt(m.id, lastRead)
  ).length;
}

/** Whether the room has any unread. */
export function hasUnread(
  roomId: string,
  messages: Array<{ id: string; sender_id: string }>,
  currentUserId: string
): boolean {
  return getUnreadCount(roomId, messages, currentUserId) > 0;
}

const MENTION_USER_RE = /<@!?(\d+)>/g;

/**
 * Extract every directly-mentioned user id from plaintext. Used client-side only when
 * composing for an E2EE room, where the server can't read the content to derive mentions
 * itself - the client declares them alongside the ciphertext instead (see api/messages.ts
 * CreateMessageInput). Non-E2EE rooms don't need this; the server parses authoritatively.
 */
export function extractMentionedUserIds(content: string): string[] {
  if (!content) return [];
  const ids = new Set<string>();
  for (const m of content.matchAll(MENTION_USER_RE)) {
    if (m[1]) ids.add(m[1]);
  }
  return Array.from(ids);
}

const MENTION_ROLE_RE = /<@&(\d+)>/g;

/**
 * Extract every mentioned role id from plaintext, same E2EE-declaration purpose as
 * extractMentionedUserIds above. Without this, a role mention (<@&roleId>) in an E2EE
 * space channel rendered as a highlighted mention but the server was never told about it,
 * so nobody holding that role ever got a mention badge for it - purely decorative.
 */
export function extractMentionedRoleIds(content: string): string[] {
  if (!content) return [];
  const ids = new Set<string>();
  for (const m of content.matchAll(MENTION_ROLE_RE)) {
    if (m[1]) ids.add(m[1]);
  }
  return Array.from(ids);
}

const MENTION_EVERYONE_RE = /(^|\W)@(everyone|here)(\W|$)/;

/**
 * Whether plaintext contains a literal @everyone/@here token (same word-boundary rule as
 * the backend's parser - a bare substring check would also fire for something like
 * "bob@everyone.works" that merely contains the text, not an actual mention).
 */
export function mentionsEveryone(content: string): boolean {
  return !!content && MENTION_EVERYONE_RE.test(content);
}

/** Room metadata for fallback unread when messages aren't loaded. */
export interface RoomUnreadMeta {
  last_message_id?: string;
  last_read_message_id?: string;
  /** Space text/voice channels: allow fallback unread when read cursor not hydrated yet. */
  space_id?: string;
}

/**
 * Unread count for display (sidebar, etc.). Uses actual messages when loaded;
 * falls back to room metadata (last_message_id vs last_read_message_id) when not.
 * Avoids false positives by only using fallback when last_read_message_id exists.
 */
export function getUnreadCountForDisplay(
  roomId: string,
  room: RoomUnreadMeta | undefined,
  messages: Array<{ id: string; sender_id: string }>,
  currentUserId: string
): number {
  if (messages.length > 0) {
    return getUnreadCount(roomId, messages, currentUserId);
  }
  const lastRead =
    readState.byRoom[roomId]?.lastReadMessageId ??
    room?.last_read_message_id ??
    null;
  const lastMsg = room?.last_message_id;
  if (!lastMsg || !isSnowflake(lastMsg)) {
    return 0;
  }
  if (!lastRead || !isSnowflake(lastRead)) {
    if (room?.space_id) {
      return 1;
    }
    return 0;
  }
  return messageIdGt(lastMsg, lastRead) ? 1 : 0;
}

export interface UnreadBannerInfo {
  /** Number of unread messages found among what's currently loaded. */
  count: number;
  /** True if there may be more unread beyond `count` - older history hasn't been paged
   * in far enough to reach the read boundary yet. Caller should render "N+". */
  capped: boolean;
  /** created_at of the oldest unread message - the "since" timestamp for the banner. */
  since: string;
}

/**
 * Info for the persistent "N new messages since TIME - Mark As Read" banner shown below
 * the room header (Discord's pattern): messages that were already unread when the room
 * was entered (bounded by the frozen entry snapshot, same window the NEW divider uses),
 * excluding the current user's own messages. Returns null when there's nothing to show -
 * caller is expected to also gate this off `newHeaderDismissed` like the divider.
 */
export function getUnreadBannerInfo(
  messages: Array<{ id: string; sender_id: string; created_at: string }>,
  lastReadMessageIdWhenEntered: string | null,
  maxMessageIdWhenEntered: string | null,
  currentUserId: string,
  hasMoreOlder: boolean
): UnreadBannerInfo | null {
  if (maxMessageIdWhenEntered == null) return null;
  const snowflakes = messages.filter((m) => isSnowflake(m.id));
  if (snowflakes.length === 0) return null;
  const unread = snowflakes.filter((m) => {
    if (m.sender_id === currentUserId) return false;
    if (messageIdGt(m.id, maxMessageIdWhenEntered)) return false; // arrived while viewing
    return lastReadMessageIdWhenEntered == null || messageIdGt(m.id, lastReadMessageIdWhenEntered);
  });
  if (unread.length === 0) return null;
  const sortedUnread = [...unread].sort((a, b) => compareMessageIds(a.id, b.id));
  const oldestOverall = snowflakes.reduce((a, b) => (messageIdGt(a.id, b.id) ? b : a));
  const capped =
    hasMoreOlder &&
    (lastReadMessageIdWhenEntered == null || messageIdGt(oldestOverall.id, lastReadMessageIdWhenEntered));
  return { count: unread.length, capped, since: sortedUnread[0]!.created_at };
}

/** Register MESSAGE_ACK handler. Call once on app init. */
export function initReadStateHandler() {
  return onStargateEvent((evt) => {
    if (evt.t !== 'MESSAGE_ACK') return;
    const d = (evt.d as Record<string, unknown>)?.d ?? evt.d;
    const data = d as Record<string, unknown>;
    const rawRoom = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
    const rawRead = data?.last_read_message_id ?? data?.message_id;
    const roomId = rawRoom != null ? String(rawRoom) : '';
    const lastRead = rawRead != null ? String(rawRead) : '';
    if (roomId && lastRead) {
      ackRoomFromEvent(roomId, lastRead);
    }
  });
}
