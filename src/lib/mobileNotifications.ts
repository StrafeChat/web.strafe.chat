/**
 * The feed behind the mobile Notifications tab.
 *
 * There is no server-side notification inbox, so this is assembled from state the client
 * already keeps current: the authoritative per-room mention counters, unread cursors, and
 * incoming friend requests. That keeps it honest (everything here is something you can act
 * on right now) and costs no extra requests.
 */

import { auth } from '../stores/auth';
import { messages } from '../stores/messages';
import { readState, getUnreadCountForDisplay } from '../stores/readState';
import { relationships, RelType } from '../stores/relationships';
import { rooms, roomDisplayName, isNotesRoom } from '../stores/rooms';
import { spaces } from '../stores/spaces';
import { isRoomMuted } from './roomNotify';
import type { Relationship } from '../api/relationships';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_THREAD = 6;

export interface NotificationItem {
  roomId: string;
  href: string;
  /** Channel or conversation name. */
  name: string;
  /** Space name for a channel; empty for a private message. */
  context: string;
  /** True for a direct mention - these sort first and read louder. */
  mention: boolean;
  count: number;
  /** Avatar for a PM, null for a channel (which uses a # glyph). */
  avatar: string | null;
  isChannel: boolean;
  /** Newest known message, so a row can be marked read in place. */
  lastMessageId: string | null;
}

function latestMessageId(roomId: string, fallback: string | undefined): string | null {
  const list = messages.byRoom[roomId] ?? [];
  const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
  if (snowflakes.length === 0) return fallback ?? null;
  return snowflakes.reduce((a, b) => (BigInt(b.id) > BigInt(a.id) ? b : a)).id;
}

/** Mentions first, then anything else unread. Muted rooms are left out entirely - a mute
 * is the user saying they don't want to be told about this room. */
export function notificationItems(): NotificationItem[] {
  const uid = auth.user?.id;
  if (!uid) return [];
  const out: NotificationItem[] = [];

  for (const room of rooms.rooms) {
    if (room.space_id) continue; // space channels are collected below, with their space name
    if (isNotesRoom(room, uid) || isRoomMuted(room)) continue;
    const mentions = readState.byRoom[room.id]?.mentionCount ?? 0;
    const unread = getUnreadCountForDisplay(room.id, room, messages.byRoom[room.id] ?? [], uid);
    if (mentions === 0 && unread === 0) continue;
    const other = room.participants?.find((p) => p.id !== uid);
    out.push({
      roomId: room.id,
      href: `/rooms/${room.id}`,
      name: roomDisplayName(room, uid),
      context: '',
      mention: mentions > 0,
      count: mentions > 0 ? mentions : unread,
      avatar: room.type === 2 ? null : other?.avatar ?? null,
      isChannel: false,
      lastMessageId: latestMessageId(room.id, room.last_message_id),
    });
  }

  for (const space of spaces.spaces) {
    for (const room of spaces.spaceRoomsBySpaceId[space.id] ?? []) {
      if (room.type !== ROOM_TYPE_TEXT && room.type !== ROOM_TYPE_THREAD) continue;
      // The rooms store copy carries this user's own mute/notify settings.
      const stored = rooms.rooms.find((r) => r.id === room.id);
      if (isRoomMuted(stored ?? room)) continue;
      const mentions = readState.byRoom[room.id]?.mentionCount ?? 0;
      // Only mentions are worth surfacing for a busy channel; plain unread in a space is
      // what the channel list's dot is for, not a notification.
      if (mentions === 0) continue;
      out.push({
        roomId: room.id,
        href: `/spaces/${space.id}/rooms/${room.id}`,
        name: room.name,
        context: space.name,
        mention: true,
        count: mentions,
        avatar: null,
        isChannel: true,
        lastMessageId: latestMessageId(room.id, room.last_message_id),
      });
    }
  }

  return out.sort((a, b) => {
    if (a.mention !== b.mention) return a.mention ? -1 : 1;
    return b.count - a.count;
  });
}

export function incomingFriendRequests(): Relationship[] {
  return relationships.relationships.filter((r) => r.type === RelType.IncomingRequest);
}

/** Badge on the Notifications tab: how many things are waiting. */
export function notificationBadgeCount(): number {
  return notificationItems().reduce((n, i) => n + i.count, 0) + incomingFriendRequests().length;
}
