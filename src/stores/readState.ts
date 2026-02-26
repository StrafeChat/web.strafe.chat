import { createStore } from 'solid-js/store';
import { onStargateEvent } from '../services/stargate/client';

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

/** Set read state from room data (REST, READY). */
export function setReadStateFromRoom(roomId: string, room: { last_read_message_id?: string; mention_count?: number }) {
  setReadState('byRoom', roomId, {
    lastReadMessageId: room.last_read_message_id ?? null,
    mentionCount: room.mention_count ?? 0,
  });
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

/** Room metadata for fallback unread when messages aren't loaded. */
export interface RoomUnreadMeta {
  last_message_id?: string;
  last_read_message_id?: string;
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
  if (!lastMsg || !lastRead || !isSnowflake(lastMsg) || !isSnowflake(lastRead)) {
    return 0;
  }
  return messageIdGt(lastMsg, lastRead) ? 1 : 0;
}

/** Register MESSAGE_ACK handler. Call once on app init. */
export function initReadStateHandler() {
  return onStargateEvent((evt) => {
    if (evt.t !== 'MESSAGE_ACK') return;
    const d = (evt.d as Record<string, unknown>)?.d ?? evt.d;
    const data = d as Record<string, unknown>;
    const roomId = data?.room_id ?? (evt as { room_id?: string }).room_id;
    const lastRead = data?.last_read_message_id ?? data?.message_id;
    if (typeof roomId === 'string' && typeof lastRead === 'string') {
      ackRoomFromEvent(roomId, lastRead);
    }
  });
}
