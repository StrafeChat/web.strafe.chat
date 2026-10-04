/**
 * Decides whether an incoming message deserves a sound / desktop notification and fires
 * it. Called after the message has been added (and decrypted) to the messages store.
 */

import { auth } from '../stores/auth';
import { messages } from '../stores/messages';
import { rooms, roomDisplayName } from '../stores/rooms';
import { spaces } from '../stores/spaces';
import { spaceMembers } from '../stores/spaceMembers';
import { extractMentionedRoleIds, extractMentionedUserIds, mentionsEveryone } from '../stores/readState';
import { notificationPrefs, playNotificationSound, showDesktopNotification } from '../stores/notificationPrefs';
import { notificationsSuppressedByStatus } from '../stores/presence';
import { getMessageBodyText, isSystemMessage, messagePreviewText } from '../components/messageList/utils';
import { isRoomMuted, NotifyModeAll, NotifyModeMentions, NotifyModeNone } from './roomNotify';
import { t } from '../i18n';

const NAVIGATE_EVENT = 'strafe:navigate';

/** Ask the app shell to route somewhere (used from outside the router tree). */
export function requestNavigate(path: string): void {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: path }));
}

export function onNavigateRequest(fn: (path: string) => void): () => void {
  const handler = (e: Event) => {
    const path = (e as CustomEvent<string>).detail;
    if (typeof path === 'string') fn(path);
  };
  window.addEventListener(NAVIGATE_EVENT, handler);
  return () => window.removeEventListener(NAVIGATE_EVENT, handler);
}

/** Room the user is looking at right now, from the URL. */
function viewedRoomId(): string | null {
  const m = window.location.pathname.match(/\/rooms\/(\d+)/);
  return m ? m[1]! : null;
}

interface RoomContext {
  path: string;
  title: string;
  spaceDefaultMentionsOnly: boolean;
  isSpace: boolean;
  muted: boolean;
  /** This room's own notify_mode override (0 = none set, fall back to the space/global default). */
  notifyModeOverride: number;
}

function roomContext(roomId: string, senderName: string): RoomContext | null {
  const uid = auth.user?.id ?? '';
  // Only a real PM (1) or group DM (2) uses pmMode. A space channel is also kept in the rooms
  // store (for its per-user mute/notify_mode), so matching on presence alone misclassified it
  // as a PM and applied pmMode - making "mentions only" for spaces silently play a sound.
  const pm = rooms.rooms.find((r) => r.id === roomId && (r.type === 1 || r.type === 2));
  if (pm) {
    const isGroup = pm.type === 2 || (pm.recipients?.length ?? 0) > 1;
    const name = roomDisplayName(pm, uid);
    return {
      path: `/rooms/${roomId}`,
      title: isGroup ? `${senderName} (${name})` : senderName,
      spaceDefaultMentionsOnly: false,
      isSpace: false,
      muted: isRoomMuted(pm),
      notifyModeOverride: pm.notify_mode ?? 0,
    };
  }
  for (const [spaceId, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    const room = list.find((r) => r.id === roomId);
    if (!room) continue;
    const space = spaces.spaces.find((s) => s.id === spaceId);
    // A space channel's per-user mute/notify_mode lives on the rooms store copy (GET /rooms
    // returns them; the space store copy from READY/space_rooms does not carry them), so read
    // it there first. Without this, a channel set to "Nothing" or muted still notified after a
    // reload - the space copy's notify_mode/muted were undefined, falling through to the global
    // space default. Mirrors mobileNotifications.notificationItems.
    const stored = rooms.rooms.find((r) => r.id === roomId);
    return {
      path: `/spaces/${spaceId}/rooms/${roomId}`,
      title: `${senderName} (#${room.name}${space ? ` · ${space.name}` : ''})`,
      spaceDefaultMentionsOnly: space?.default_message_notifications === 1,
      isSpace: true,
      muted: isRoomMuted(stored ?? room),
      notifyModeOverride: stored?.notify_mode ?? room.notify_mode ?? 0,
    };
  }
  return null;
}

function senderName(roomId: string, senderId: string): string {
  const pm = rooms.rooms.find((r) => r.id === roomId);
  const p = pm?.participants?.find((x) => x.id === senderId);
  if (p) return p.display_name || p.username;
  for (const list of Object.values(spaceMembers.bySpaceId)) {
    const m = list.find((x) => x.id === senderId);
    if (m) return m.display_name || m.username;
  }
  return t('common.someone');
}

function mentionsMe(roomId: string, content: string): boolean {
  const me = auth.user?.id;
  if (!me) return false;
  if (mentionsEveryone(content)) return true;
  if (extractMentionedUserIds(content).includes(me)) return true;
  const roleIds = extractMentionedRoleIds(content);
  if (roleIds.length === 0) return false;
  for (const [spaceId, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    if (!list.some((r) => r.id === roomId)) continue;
    const mine = spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === me)?.roles ?? [];
    return roleIds.some((rid) => mine.includes(rid));
  }
  return false;
}

/** Notify for a message that just arrived, if the user's preferences say so. */
export function maybeNotifyMessage(roomId: string, messageId: string): void {
  const prefs = notificationPrefs;
  if (!prefs.desktop && !prefs.sounds) return;
  // Do Not Disturb silences all message notifications (sound + desktop); the unread/mention
  // counters are updated elsewhere, so activity is still visible in-app.
  if (notificationsSuppressedByStatus()) return;
  const me = auth.user?.id;
  const msg = messages.byRoom[roomId]?.find((m) => m.id === messageId);
  if (!msg || !me || msg.sender_id === me || isSystemMessage(msg) || msg.pending) return;

  const focusedHere = document.visibilityState === 'visible' && viewedRoomId() === roomId;
  if (focusedHere && !prefs.whileFocused) return;

  const sender = senderName(roomId, msg.sender_id);
  const ctx = roomContext(roomId, sender);
  if (!ctx) return;
  if (ctx.muted) return;

  const body = getMessageBodyText(msg);
  // The room's own override wins over the space/global default; "default" (0) falls
  // through to the existing space-default-mentions-only / global per-room-type logic.
  let mode: 'all' | 'mentions' | 'none';
  if (ctx.notifyModeOverride === NotifyModeAll) {
    mode = 'all';
  } else if (ctx.notifyModeOverride === NotifyModeMentions) {
    mode = 'mentions';
  } else if (ctx.notifyModeOverride === NotifyModeNone) {
    mode = 'none';
  } else if (ctx.isSpace) {
    mode = prefs.spaceMode;
    if (mode === 'all' && ctx.spaceDefaultMentionsOnly) mode = 'mentions';
  } else {
    mode = prefs.pmMode;
  }
  if (mode === 'none') return;
  if (mode === 'mentions' && !mentionsMe(roomId, body)) return;

  if (prefs.sounds) playNotificationSound(prefs.volume);
  if (prefs.desktop) {
    const preview = prefs.preview ? messagePreviewText(body, undefined, me, 140) || t('notifications.newMessage') : t('notifications.newMessage');
    showDesktopNotification({
      title: ctx.title,
      body: preview,
      tag: `room:${roomId}`,
      onClick: () => requestNavigate(ctx.path),
    });
  }
}
