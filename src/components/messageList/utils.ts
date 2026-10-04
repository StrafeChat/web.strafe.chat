import type { DecryptedMessage } from '../../stores/messages';
import { auth } from '../../stores/auth';
import { spaces } from '../../stores/spaces';
import type { RoomParticipant } from '../../api/rooms';
import { birthdayIsToday } from '../../lib/utils/birthday';
import { t } from '../../i18n';

export const LOADING_PLACEHOLDER = '...';

/** Body shown for a message whose ciphertext could not be decrypted. */
export function decryptErrorPlaceholder(): string {
  return t('messages.decryptFailed');
}

/**
 * The room's participants plus any users embedded on the messages themselves - a message's
 * `author`, its `mention_users`, and a reply's `referenced_message.author`. The server now
 * embeds those (Discord-style) so a sender/mention the client never cached still resolves to a
 * name + avatar; folding them into the participant pool lets every existing lookup
 * (getSenderDisplay, mention pills, reply references) find them with no other change. Returns
 * the original array unchanged when nothing new is added (the common case - authors are
 * usually already members), so it doesn't churn a fresh array on every render.
 */
export function augmentParticipants(
  participants: RoomParticipant[] | undefined,
  messages: DecryptedMessage[]
): RoomParticipant[] {
  const base = participants ?? [];
  const seen = new Set(base.map((p) => p.id));
  const extra: RoomParticipant[] = [];
  const add = (u?: RoomParticipant | null) => {
    if (u && u.id && !seen.has(u.id)) {
      seen.add(u.id);
      extra.push(u);
    }
  };
  for (const m of messages) {
    add(m.author);
    if (m.mention_users) for (const u of m.mention_users) add(u);
    add(m.referenced_message?.author);
  }
  return extra.length ? [...base, ...extra] : base;
}

export function getMessageBodyText(msg: DecryptedMessage): string {
  // A failed decrypt leaves plaintext as '' (not null), so this has to win over the
  // plaintext check or the message renders as a blank line with no explanation.
  if (msg.decryptError) return decryptErrorPlaceholder();
  if (msg.plaintext != null) return msg.plaintext;
  return LOADING_PLACEHOLDER;
}

export function isSystemMessage(msg: DecryptedMessage): msg is DecryptedMessage & { system_type: string; system_payload: string } {
  return !!(msg as DecryptedMessage & { system_type?: string }).system_type;
}

function participantName(id: string, participants?: RoomParticipant[], currentUserId?: string): string {
  if (id === currentUserId) return auth.user?.display_name || auth.user?.username || t('common.you');
  const p = participants?.find((x) => x.id === id);
  return p?.display_name || p?.username || t('common.someone');
}

export function formatSystemMessageText(
  msg: DecryptedMessage & { system_type: string; system_payload: string },
  participants?: RoomParticipant[],
  currentUserId?: string
): string {
  const payload = (() => {
    try {
      return JSON.parse(msg.system_payload || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const actor = participantName(payload.actor_id ?? '', participants, currentUserId);
  const user = participantName(payload.user_id ?? '', participants, currentUserId);
  switch (msg.system_type) {
    case 'member_added':
      return t('messages.system.memberAdded', { actor, user });
    case 'member_removed':
      return t('messages.system.memberRemoved', { actor, user });
    case 'member_left':
      return t('messages.system.memberLeft', { user });
    case 'space_member_join':
      return t('messages.system.spaceJoin', { user });
    case 'space_member_leave':
      return payload.how === 'kicked'
        ? t('messages.system.spaceKicked', { user })
        : payload.how === 'banned'
          ? t('messages.system.spaceBanned', { user })
          : t('messages.system.spaceLeave', { user });
    case 'space_birthday': {
      // The space's own greeting template, with {user} naming the member. Empty (the space
      // never set one) falls back to the default line, so the day is still announced.
      const custom = typeof payload.message === 'string' ? payload.message.trim() : '';
      return custom ? custom.replace(/\{user\}/g, user) : t('messages.system.birthday', { user });
    }
    case 'room_renamed':
      return t('messages.system.roomRenamed', { actor, name: payload.new_name ?? '?' });
    case 'call_started':
      return t('messages.system.callStarted', { actor });
    case 'call_ended':
      return t('messages.system.callEnded', { duration: formatCallDuration(Number(payload.duration_seconds ?? 0)) });
    default:
      return t('messages.system.default');
  }
}

/** "1h 02m", "12m 05s", "38s". */
export function formatCallDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/**
 * One-line, human-readable form of a message for previews (reply references, the composer's
 * reply strip, pinned/search cards): mention tokens become @name / #channel, markdown
 * markers are dropped, whitespace is collapsed.
 */
export function messagePreviewText(
  text: string,
  participants?: RoomParticipant[],
  currentUserId?: string,
  maxLength = 90
): string {
  let out = text
    .replace(/<a?:([A-Za-z0-9_]{2,32}):\d+>/g, ':$1:')
    .replace(/<@!?(\d+)>/g, (_m, uid: string) => `@${participantName(uid, participants, currentUserId)}`)
    .replace(/<@&(\d+)>/g, `@${t('messages.preview.role')}`)
    .replace(/<#(\d+)>/g, (_m, rid: string) => `#${channelNameForPreview(rid)}`)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (out.length > maxLength) out = `${out.slice(0, maxLength - 1)}…`;
  return out;
}

function channelNameForPreview(roomId: string): string {
  for (const list of Object.values(spaces.spaceRoomsBySpaceId)) {
    const r = list.find((x) => x.id === roomId);
    if (r) return r.name || t('messages.preview.unnamed');
  }
  return t('messages.preview.room');
}

export function isEdited(msg: DecryptedMessage): boolean {
  if (!msg.updated_at || !msg.created_at) return false;
  return new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 1000;
}

export interface SenderDisplay {
  userId: string;
  name: string;
  avatar?: string;
  banner?: string;
  username?: string;
  discriminator?: number;
  bio?: string;
  aboutMe?: string;
  pronouns?: string;
  /** "MM-DD", no year - present only for people who opted in to birthday announcements. */
  birthday?: string;
  /** Whether today is this person's birthday (the server decides, in UTC). */
  isBirthday?: boolean;
  publicFlags?: number;
  bot?: boolean;
  /** Federation: the user's home instance, shown after the tag when it isn't this one. */
  homeDomain?: string;
}

export function getSenderDisplay(
  senderId: string,
  participants?: RoomParticipant[],
  currentUserId?: string
): SenderDisplay {
  if (senderId === currentUserId) {
    return {
      userId: senderId,
      name: auth.user?.display_name || auth.user?.username || t('common.you'),
      avatar: auth.user?.avatar,
      banner: auth.user?.banner,
      username: auth.user?.username,
      discriminator: auth.user?.discriminator,
      bio: auth.user?.bio,
      aboutMe: auth.user?.about_me,
      pronouns: auth.user?.pronouns,
      birthday: auth.user?.birthday,
      isBirthday: birthdayIsToday(auth.user?.birthday),
      publicFlags: auth.user?.public_flags,
      bot: auth.user?.bot,
    };
  }
  const p = participants?.find((x) => x.id === senderId);
  return {
    userId: senderId,
    name: p?.display_name || p?.username || t('common.unknown'),
    avatar: p?.avatar,
    banner: p?.banner,
    username: p?.username,
    discriminator: p?.discriminator,
    bio: p?.bio,
    aboutMe: p?.about_me,
    pronouns: p?.pronouns,
    birthday: p?.birthday,
    isBirthday: birthdayIsToday(p?.birthday, p?.is_birthday),
    publicFlags: p?.public_flags,
    bot: p?.bot,
    homeDomain: p?.home_domain,
  };
}
