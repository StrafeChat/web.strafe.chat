import type { DecryptedMessage } from '../../stores/messages';
import { auth } from '../../stores/auth';
import { spaces } from '../../stores/spaces';
import type { RoomParticipant } from '../../api/rooms';
import { resolveProfile } from '../../lib/spaceProfile';
import { birthdayIsToday } from '../../lib/utils/birthday';
import { formatTimestamp, timestampStyle } from '../../lib/utils/messageTimestamp';
import { embedPreviewText } from '../../lib/embeds/messageEmbeds';
import { t } from '../../i18n';
import { webhookAuthorOf, type BridgedIdentity } from '../../lib/webhookMessages';
import { bridgePlatformLabel, masqueradeColourHex } from '../../lib/bridgePlatforms';
import { appearance } from '../../stores/appearance';

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
    // A webhook's (or bridge's) `author` is a per-message identity under the webhook's id:
    // folded in by id, one webhook would take one name for every message it posted.
    if (!m.webhook_id) add(m.author);
    if (m.mention_users) for (const u of m.mention_users) add(u);
    if (!m.referenced_message?.webhook_id) add(m.referenced_message?.author);
  }
  return extra.length ? [...base, ...extra] : base;
}

export function getMessageBodyText(msg: DecryptedMessage): string {
  // A message that can't be read carries a flag and an empty plaintext (not null), so the
  // explanation is said here, in the reader's language, and has to win over the plaintext
  // check or the message renders as a blank line with no explanation.
  if (msg.decryptError) return decryptErrorPlaceholder();
  if (msg.legacyUndecryptable) return t('messages.legacyUndecryptable');
  if (msg.decryptPending) return msg.sentBeforeJoin ? t('messages.sentBeforeJoin') : t('messages.waitingForKey');
  if (msg.plaintext != null) return msg.plaintext;
  return LOADING_PLACEHOLDER;
}

/**
 * The text a one-line preview of a message is made from (reply strips, notifications, a
 * thread's suggested name): its body, or - for a bot's message that is only embeds - the first
 * embed's title or description. Embeds count only on a message this client read in the clear.
 */
export function getMessagePreviewSource(msg: DecryptedMessage): string {
  const body = getMessageBodyText(msg);
  if (body || !msg.notEncrypted) return body;
  return embedPreviewText(msg.embeds);
}

export function isSystemMessage(msg: DecryptedMessage): msg is DecryptedMessage & { system_type: string; system_payload: string } {
  return !!(msg as DecryptedMessage & { system_type?: string }).system_type;
}

function participantName(id: string, participants?: RoomParticipant[], currentUserId?: string): string {
  // Same two branches as getSenderDisplay: your own global profile from auth.user (the
  // freshest copy), overlaid with your row in this list - which, in a space, carries your
  // nickname. System lines, reply strips and mention previews all name people through here.
  const p = participants?.find((x) => x.id === id);
  if (id === currentUserId) return resolveProfile(auth.user, p, t('common.you')).name;
  return resolveProfile(p, p, t('common.someone')).name;
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
    case 'message_pinned':
      return t('messages.system.pinned', { actor });
    case 'thread_created':
      return t('messages.system.threadCreated', { actor, name: payload.name ?? '?' });
    case 'thread_renamed':
      return t('messages.system.threadRenamed', { actor, name: payload.name ?? '?' });
    case 'room_renamed':
      return t('messages.system.roomRenamed', { actor, name: payload.new_name ?? '?' });
    case 'call_started':
      return t('messages.system.callStarted', { actor });
    case 'call_ended':
      return t('messages.system.callEnded', { duration: formatCallDuration(Number(payload.duration_seconds ?? 0)) });
    case 'bridge_created':
    case 'bridge_deleted':
      return formatBridgeNotice(msg.system_type, payload, participants, currentUserId);
    default:
      return t('messages.system.default');
  }
}

/**
 * The notice a bridge leaves in its room when it is created or removed (spec 5.9): who did it,
 * which platform (and remote room, as the bridge declared it) and through which bot, and that
 * people's own privacy settings decide whether their messages are copied.
 */
function formatBridgeNotice(
  type: 'bridge_created' | 'bridge_deleted',
  payload: Record<string, unknown>,
  participants?: RoomParticipant[],
  currentUserId?: string
): string {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const remoteObj = payload.remote && typeof payload.remote === 'object' ? (payload.remote as Record<string, unknown>) : undefined;
  const platform = bridgePlatformLabel(str(payload.platform), str(payload.platform_name));
  const remote = str(payload.remote_name) || str(remoteObj?.name);
  const target = remote ? t('messages.system.bridgeTarget', { platform, remote }) : platform;
  const driverId = str(payload.driver_id) || (payload.driver_id != null ? String(payload.driver_id) : '');
  const driver =
    str(payload.driver_name) ||
    (driverId ? participantName(driverId, participants, currentUserId) : '') ||
    str(payload.bridge_name) ||
    t('bridges.card.theBot');
  // A bot-driven bridge is made by its own bot: "Strife bridged this room...", not "Strife
  // bridged this room ... through Strife".
  const actorId = payload.actor_id != null && String(payload.actor_id) !== driverId ? String(payload.actor_id) : '';
  const actor = actorId ? participantName(actorId, participants, currentUserId) : '';
  if (type === 'bridge_created') {
    return actor ? t('messages.system.bridgeCreated', { actor, target, driver }) : t('messages.system.bridgeCreatedNoActor', { target, driver });
  }
  return actor ? t('messages.system.bridgeDeleted', { actor, target }) : t('messages.system.bridgeDeletedNoActor', { target });
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
    // Dynamic timestamps resolve to the reader's own rendering, same as the message body -
    // a raw `<t:…>` in a reply strip or a desktop notification helps nobody. (A timestamp
    // inside a code span also resolves here; the message body keeps showing it verbatim.)
    .replace(/<t:(-?\d{1,11})(?::([tTdDfFRsS]))?>/g, (_m, unix: string, style?: string) =>
      formatTimestamp(new Date(Number(unix) * 1000), timestampStyle(style))
    )
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
  /** The name to show: their nickname in this space, else their display name. */
  name: string;
  /** Their global display name (else username), whatever `name` resolved to. */
  globalName?: string;
  /** Their space nickname, when the participants are a space's and one is set. */
  nick?: string;
  avatar?: string;
  banner?: string;
  username?: string;
  bio?: string;
  aboutMe?: string;
  pronouns?: string;
  /** "MM-DD", no year - present only for people who opted in to birthday announcements. */
  birthday?: string;
  /** Whether today is this person's birthday (the server decides, in UTC). */
  isBirthday?: boolean;
  publicFlags?: number;
  bot?: boolean;
  system?: boolean;
  /** Federation: the user's home instance, shown after the tag when it isn't this one. */
  homeDomain?: string;
  /** Federation: the id their home instance knows them by (picks their default avatar). */
  originId?: string;
  /** The account was deleted: `name` is "Deleted User"; menus and cards offer only Copy ID. */
  deleted?: boolean;
  /** Posted by a webhook (or a bridge): `userId` is the webhook id, not a person. Shown with
   * the WEBHOOK tag, a webhook card and none of the person actions (message, add friend,
   * nickname, roles, kick). */
  webhook?: { id: string; kind: 'webhook' | 'bridge'; puppetId?: string; bridge?: BridgedIdentity };
  /** A bridged person's name colour (0xRRGGBB as `#rrggbb`), when their bridge allows it. */
  colour?: string;
}

/**
 * Who a message shows as: getSenderDisplay for a person, or the message's own snapshotted
 * identity when a webhook posted it (never looked up by id - one webhook posts under many
 * names). Use this, not getSenderDisplay(msg.sender_id), anywhere a message is the subject.
 */
export function getMessageSenderDisplay(
  msg: Pick<DecryptedMessage, 'sender_id' | 'webhook_id' | 'masquerade' | 'author'>,
  participants?: RoomParticipant[],
  currentUserId?: string
): SenderDisplay {
  const w = webhookAuthorOf(msg, t('webhooks.defaultName'));
  if (!w) return getSenderDisplay(msg.sender_id, participants, currentUserId);
  const colour = masqueradeColourHex(w.bridge?.colour);
  return {
    // The default avatar is picked from this id: a bridged person's own stable id, so each
    // looks the same in every message and two people of one bridge don't share a picture.
    userId: w.puppetId ?? w.webhookId,
    name: w.name,
    // The reader can turn pictures from other services off (Appearance).
    avatar: appearance.externalAvatars ? w.avatar : undefined,
    webhook: {
      id: w.webhookId,
      kind: w.kind,
      ...(w.puppetId ? { puppetId: w.puppetId } : {}),
      ...(w.bridge ? { bridge: w.bridge } : {}),
    },
    ...(colour ? { colour } : {}),
  };
}

/**
 * Who sent a message, as every message-side surface shows them (author rows, typing, reply
 * strips, pins, search). `participants` are the room's people: in a space, its member rows,
 * which carry each member's space profile - so a nickname or space avatar shows wherever this
 * is used, and in a PM (no space fields) the global profile does.
 */
export function getSenderDisplay(
  senderId: string,
  participants?: RoomParticipant[],
  currentUserId?: string
): SenderDisplay {
  if (senderId === currentUserId) {
    // Your global profile comes from auth.user, but your space profile only exists on your
    // member row; without that overlay you would be the one person whose nickname never
    // showed on their own messages.
    const r = resolveProfile(auth.user, participants?.find((x) => x.id === senderId), t('common.you'));
    return {
      userId: senderId,
      name: r.name,
      globalName: r.globalName,
      ...(r.nick ? { nick: r.nick } : {}),
      avatar: r.avatar,
      banner: r.banner,
      username: auth.user?.username,
      bio: r.bio,
      aboutMe: r.aboutMe,
      pronouns: r.pronouns,
      birthday: auth.user?.birthday,
      isBirthday: birthdayIsToday(auth.user?.birthday),
      publicFlags: auth.user?.public_flags,
      bot: auth.user?.bot,
      system: false,
    };
  }
  const p = participants?.find((x) => x.id === senderId);
  const r = resolveProfile(p, p);
  return {
    userId: senderId,
    name: r.name,
    globalName: r.globalName,
    ...(r.nick ? { nick: r.nick } : {}),
    avatar: r.avatar,
    banner: r.banner,
    username: p?.username,
    bio: r.bio,
    aboutMe: r.aboutMe,
    pronouns: r.pronouns,
    birthday: p?.birthday,
    isBirthday: birthdayIsToday(p?.birthday, p?.is_birthday),
    publicFlags: p?.public_flags,
    bot: p?.bot,
    system: p?.system,
    homeDomain: p?.home_domain,
    originId: p?.origin_id,
    ...(r.deleted ? { deleted: true } : {}),
  };
}
