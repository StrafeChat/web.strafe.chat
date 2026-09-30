import { previewUrlsFor } from '../lib/linkPreviewUrls';
import { warmLinkPreviews } from './linkPreviews';
import { createStore } from 'solid-js/store';
import {
  listMessages,
  createMessage,
  editMessage as editMessageApi,
  uploadAttachment,
  addReaction as addReactionApi,
  removeReaction as removeReactionApi,
  type Attachment,
  type Message,
  type CreateMessageInput,
  type MessageReaction,
} from '../api/messages';
import { ensureDevice, encryptMessage } from '../lib/e2ee';
import { getCurrentDeviceId } from '../lib/e2ee/machine';
import { encryptAttachment } from '../lib/attachments/crypto';
import {
  encryptedMetaFromView,
  viewFromEncryptedMeta,
  type AttachmentView,
  type EncryptedAttachmentMeta,
} from '../lib/attachments/types';
import type { PendingAttachment } from '../lib/attachments/draft';
import {
  preferResolved,
  resolveMemberUserIds,
  resolvePlaintext,
  roomE2EEOff,
  viewFromServerAttachment,
  type ResolvedFields,
} from '../lib/messageWireFormat';
import { removeTyping } from './typing';

/** Re-exported: search builds display messages from raw server rows too. */
export { viewFromServerAttachment };
import { auth } from './auth';
import { settings } from './settings';
import { rooms, updateRoomLastMessage } from './rooms';
import { updateSpaceRoomLastMessage } from './spaces';
import { onStargateEvent } from '../services/stargate/client';
import { maybeNotifyMessage } from '../lib/notifications';
import { setReadState, extractMentionedUserIds, extractMentionedRoleIds, mentionsEveryone } from './readState';

/** Sort messages by created_at ascending (oldest first) */
function sortByCreatedAt<T extends { created_at: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Generate a unique temp ID for optimistic messages */
function createTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface DecryptedMessage extends Omit<Message, 'attachments'> {
  plaintext?: string;
  /** Attachments in display form. In E2EE rooms these came out of the decrypted body and
   * carry the per-file key; the server-side copy only knows id/url/size for those. */
  attachments?: AttachmentView[];
  decryptError?: boolean;
  /** True when the Megolm room key for this message hasn't arrived yet - a "waiting for
   * key" state, not an error; it resolves itself once the to-device share is processed. */
  decryptPending?: boolean;
  /** True when the message predates the current engine (old static-key scheme) and can no
   * longer be decrypted - that engine's key material was deleted along with it. */
  legacyUndecryptable?: boolean;
  /** True when message was sent without E2EE (room has E2EE disabled) */
  notEncrypted?: boolean;
  /** True when message is optimistic (not yet confirmed by server) */
  pending?: boolean;
  reactions?: MessageReaction[];
}

export interface MessagesState {
  byRoom: Record<string, DecryptedMessage[]>;
  loading: Record<string, boolean>;
  loadingOlder: Record<string, boolean>;
  hasMoreOlder: Record<string, boolean>;
  sending: Record<string, boolean>;
  scrollToBottomTick: Record<string, number>;
}

export const [messages, setMessages] = createStore<MessagesState>({
  byRoom: {},
  loading: {},
  loadingOlder: {},
  hasMoreOlder: {},
  sending: {},
  scrollToBottomTick: {},
});

const MESSAGES_PAGE_SIZE = 30;

function setTempAttachmentProgress(roomId: string, tempId: string, localId: string, progress: number) {
  setMessages('byRoom', roomId, (prev) =>
    (prev ?? []).map((m) =>
      m.id !== tempId
        ? m
        : { ...m, attachments: (m.attachments ?? []).map((a) => (a.id === localId ? { ...a, progress } : a)) }
    )
  );
}

/**
 * Re-attempt decryption for every message still waiting on a room key. Megolm keys arrive
 * as to-device messages, and a MESSAGE_CREATE can easily be processed before the
 * to-device share that unlocks it (they're published back-to-back by the sender), so
 * without this a message that raced its own key would sit at "waiting" until a reload.
 * Called after each batch of to-device messages is fed into the engine.
 */
export async function retryPendingDecrypts(): Promise<void> {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  for (const [roomId, list] of Object.entries(messages.byRoom)) {
    const waiting = list.filter((m) => m.decryptPending && !m.system_type && !m.id.startsWith('temp-'));
    if (waiting.length === 0) continue;
    const resolved = await Promise.all(
      waiting.map(async (m) => {
        // Not the stored object: its `plaintext` is the placeholder, which resolvePlaintext
        // would otherwise take for server-stored plaintext.
        const fields = await resolvePlaintext(currentUserId, {
          id: m.id,
          room_id: m.room_id,
          sender_id: m.sender_id,
          ciphertext: m.ciphertext,
          created_at: m.created_at,
        });
        return [m.id, fields] as const;
      })
    );
    const changed = new Map(resolved.filter(([, f]) => !f.decryptPending));
    if (changed.size === 0) continue;
    setMessages('byRoom', roomId, (prev) =>
      (prev ?? []).map((m) => (changed.has(m.id) ? { ...m, ...changed.get(m.id)! } : m))
    );
  }
}

/** How long a page of history waits for its link previews before rendering anyway. */
const PREVIEW_WARM_INITIAL_MS = 1200;
const PREVIEW_WARM_OLDER_MS = 600;

/** Mirrors MessageList's gate: plain rooms always preview; encrypted rooms only by choice. */
function linkPreviewsAllowedIn(roomId: string): boolean {
  const room = rooms.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  return room.e2ee_enabled !== true || !!settings.linkPreviewsInEncrypted;
}

export async function loadMessages(
  roomId: string,
  before?: string,
  getScrollContainer?: () => HTMLDivElement | undefined,
  opts?: { quiet?: boolean }
) {
  const isInitialLoad = !before;
  if (isInitialLoad) {
    setMessages('loading', roomId, true);
    setMessages('hasMoreOlder', roomId, true);
  } else {
    setMessages('loadingOlder', roomId, true);
  }
  const currentUserId = auth.user?.id;
  if (!currentUserId) {
    if (isInitialLoad) setMessages('loading', roomId, false);
    else setMessages('loadingOlder', roomId, false);
    return;
  }

  try {
    try {
      await ensureDevice(currentUserId);
    } catch (e) {
      console.warn('ensureDevice failed, decryption may fail:', e);
    }
    const list = await listMessages(roomId, { before, limit: MESSAGES_PAGE_SIZE });
    const decrypted = await Promise.all(
      list.map(async (m): Promise<DecryptedMessage> => {
        if (m.system_type) {
          return { ...m, plaintext: '', attachments: [] };
        }
        const resolved = await resolvePlaintext(currentUserId, m);
        return { ...m, ...resolved };
      })
    );
    // Fetch this page's link previews before showing it, so the cards are in place when the
    // messages appear instead of popping in one by one and shoving the conversation around
    // (the same page of history would otherwise reflow once per link). Bounded: a slow site
    // can't hold the room back, its card just arrives late as before.
    if (linkPreviewsAllowedIn(roomId)) {
      const urls = new Set<string>();
      for (const m of decrypted) {
        if (!m.system_type && m.plaintext) for (const u of previewUrlsFor(m.plaintext)) urls.add(u);
      }
      if (urls.size > 0) await warmLinkPreviews(urls, isInitialLoad ? PREVIEW_WARM_INITIAL_MS : PREVIEW_WARM_OLDER_MS);
    }
    const container = getScrollContainer?.();
    const saved = container
      ? { scrollTop: container.scrollTop, scrollHeight: container.scrollHeight }
      : null;
    setMessages('hasMoreOlder', roomId, list.length >= MESSAGES_PAGE_SIZE);
    setMessages('byRoom', roomId, (prev) => {
      const existing = prev ?? [];
      const ids = new Set(existing.map((x) => x.id));
      const merged = [...existing];
      for (const m of decrypted) {
        if (!ids.has(m.id)) {
          ids.add(m.id);
          merged.push(m);
        }
      }
      return sortByCreatedAt(merged);
    });
    if (isInitialLoad && decrypted.length > 0 && !opts?.quiet) {
      setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
    }
    if (!isInitialLoad && saved && container) {
      const restore = () => {
        const heightAdded = container.scrollHeight - saved.scrollHeight;
        if (heightAdded > 0) {
          container.scrollTop = saved.scrollTop + heightAdded;
          return true;
        }
        return false;
      };
      if (!restore()) requestAnimationFrame(restore);
    }
  } finally {
    if (isInitialLoad) {
      setMessages('loading', roomId, false);
    } else {
      setMessages('loadingOlder', roomId, false);
    }
  }
}

/** Load older messages (for infinite scroll up). Uses oldest message id as cursor. */
export async function loadOlderMessages(
  roomId: string,
  getScrollContainer?: () => HTMLDivElement | undefined
): Promise<boolean> {
  const list = messages.byRoom[roomId] ?? [];
  if (list.length === 0 || messages.loadingOlder[roomId]) return false;
  if (messages.hasMoreOlder[roomId] === false) return false;
  const oldest = list.find((m) => !m.id.startsWith('temp-'));
  if (!oldest) return false;
  await loadMessages(roomId, oldest.id, getScrollContainer);
  return true;
}

export async function sendMessage(
  roomId: string,
  plaintext: string,
  replyToId?: string,
  pendingAttachments: PendingAttachment[] = []
): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;
  if (!plaintext && pendingAttachments.length === 0) return null;

  const participants = room.participants ?? [];
  const otherParticipant = participants.find((p) => p.id !== currentUserId);
  const isNotesRoom = !otherParticipant && participants.length === 1;
  const isGroupRoom = room.type === 2 && participants.length >= 2;
  const isSpaceTextRoom = room.type === 3;
  if (!otherParticipant && !isNotesRoom && !isGroupRoom && !isSpaceTextRoom) return null;

  const nonce = createTempId();
  const now = new Date().toISOString();
  // Optimistic previews straight from the local files, with a progress bar per upload.
  const tempAttachments: AttachmentView[] = pendingAttachments.map((p) => ({
    id: p.localId,
    url: p.previewUrl ?? '',
    filename: p.file.name || 'file',
    contentType: p.file.type || 'application/octet-stream',
    size: p.file.size,
    width: p.width,
    height: p.height,
    previewUrl: p.previewUrl,
    uploading: true,
    progress: 0,
  }));
  const tempMsg: DecryptedMessage = {
    id: nonce,
    room_id: roomId,
    sender_id: currentUserId,
    sender_device_id: '1',
    ciphertext: '',
    created_at: now,
    updated_at: now,
    plaintext,
    pending: true,
    reply_to_id: replyToId,
    attachments: tempAttachments,
  };

  setMessages('byRoom', roomId, (prev) => sortByCreatedAt([...(prev ?? []), tempMsg]));
  setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);

  setMessages('sending', roomId, true);
  try {
    await ensureDevice(currentUserId);
    const deviceId = getCurrentDeviceId();
    if (!deviceId) throw new Error('E2EE device not initialized');
    const e2eeOff = roomE2EEOff(room, isGroupRoom, isSpaceTextRoom);

    // Never Number() either id: snowflakes are > 2^53, so a numeric id arrives at the
    // server rounded to the nearest 8 (every reply used to point at a message that
    // doesn't exist, and every message recorded a sender device that doesn't either).
    const input: CreateMessageInput = {
      sender_device_id: deviceId,
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    };

    // Uploads go first so the message can reference them by id. Plaintext rooms upload
    // the file as-is and the server records name/type/dimensions. E2EE rooms upload an
    // AES-GCM ciphertext blob the server can't interpret; the metadata and key travel
    // inside the Megolm-encrypted body below, so only people who can read the message can
    // open the file.
    const sentAttachments: AttachmentView[] = [];
    const encryptedMetas: EncryptedAttachmentMeta[] = [];
    if (pendingAttachments.length > 0) {
      input.attachments = [];
      for (const p of pendingAttachments) {
        const onProgress = (fraction: number) => setTempAttachmentProgress(roomId, nonce, p.localId, fraction);
        if (e2eeOff) {
          const a = await uploadAttachment(roomId, p.file, {
            filename: p.file.name,
            width: p.width,
            height: p.height,
            onProgress,
          });
          sentAttachments.push({ ...viewFromServerAttachment(a), previewUrl: p.previewUrl });
          input.attachments.push(a.id);
        } else {
          const { blob, material } = await encryptAttachment(p.file);
          const a = await uploadAttachment(roomId, blob, { encrypted: true, onProgress });
          const meta: EncryptedAttachmentMeta = {
            id: a.id,
            url: a.url,
            filename: p.file.name || 'file',
            content_type: p.file.type || 'application/octet-stream',
            size: p.file.size,
            width: p.width,
            height: p.height,
            key: material.key,
            iv: material.iv,
          };
          encryptedMetas.push(meta);
          sentAttachments.push({ ...viewFromEncryptedMeta(meta), previewUrl: p.previewUrl });
          input.attachments.push(a.id);
        }
      }
    }

    if (e2eeOff) {
      if (plaintext) input.plaintext = plaintext;
    } else {
      const memberUserIds = await resolveMemberUserIds(currentUserId, room, participants, isSpaceTextRoom);
      input.ciphertext = await encryptMessage(
        currentUserId,
        roomId,
        memberUserIds,
        plaintext,
        encryptedMetas.length > 0 ? { attachments: encryptedMetas } : undefined
      );
      input.mentions = extractMentionedUserIds(plaintext);
      input.mention_roles = extractMentionedRoleIds(plaintext);
      input.mention_everyone = mentionsEveryone(plaintext);
    }

    const msg = await createMessage(roomId, input);

    const confirmed: DecryptedMessage = { ...msg, plaintext, notEncrypted: e2eeOff, attachments: sentAttachments };
    let didReplaceInPlace = false;
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      const tempIdx = list.findIndex((m) => m.id === nonce);
      const existingIdx = list.findIndex((m) => m.id === msg.id);
      if (existingIdx >= 0) {
        didReplaceInPlace = true;
        return list.map((m, i) => (i === existingIdx ? { ...m, ...confirmed, plaintext } : m));
      }
      if (tempIdx >= 0) {
        didReplaceInPlace = true;
        const merged = [...list];
        merged[tempIdx] = confirmed;
        return merged;
      }
      return sortByCreatedAt([...list, confirmed]);
    });
    if (!didReplaceInPlace) {
      setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
    }
    return msg;
  } catch (err) {
    setMessages('byRoom', roomId, (prev) => (prev ?? []).filter((m) => m.id !== nonce));
    throw err;
  } finally {
    setMessages('sending', roomId, false);
  }
}

export function clearMessages(roomId?: string) {
  if (roomId) {
    setMessages('byRoom', roomId, []);
  } else {
    setMessages('byRoom', {});
  }
}

/** Add a message from Stargate MESSAGE_CREATE event */
export async function addMessageFromEvent(payload: {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  plaintext?: string;
  reply_to_id?: string;
  system_type?: string;
  system_payload?: string;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  if (payload.system_type) {
    const msg: DecryptedMessage = {
      ...payload,
      plaintext: '',
      attachments: [],
    };
    let didAppend = false;
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      if (list.some((m) => m.id === msg.id)) return list;
      didAppend = true;
      return sortByCreatedAt([...list, msg]);
    });
    if (didAppend) {
      setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
    }
    return;
  }
  removeTyping(roomId, String(payload.sender_id));
  const currentUserId = auth.user?.id;
  if (currentUserId) {
    try {
      await ensureDevice(currentUserId);
    } catch {
      // fall through; decrypt will fail and we'll set decryptError
    }
  }
  const resolved: ResolvedFields = currentUserId
    ? await resolvePlaintext(currentUserId, payload)
    : { plaintext: '', decryptError: true, attachments: [] };

  const msg: DecryptedMessage = { ...payload, ...resolved };
  let didReplaceInPlace = false;
  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      didReplaceInPlace = true;
      const existing = list[existingIdx]!;
      return list.map((m, i) => (i === existingIdx ? { ...existing, ...payload, ...preferResolved(existing, resolved) } : m));
    }
    const isOwn = String(payload.sender_id) === currentUserId;
    const tempIdx = isOwn
      ? list.findIndex(
          (m) => m.pending && String(m.sender_id) === currentUserId && m.plaintext === resolved.plaintext
        )
      : -1;
    if (tempIdx >= 0) {
      didReplaceInPlace = true;
      const merged = [...list];
      merged[tempIdx] = msg;
      return merged;
    }
    return sortByCreatedAt([...list, msg]);
  });
  if (!didReplaceInPlace) {
    setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
  }
}

/** Update a message from Stargate MESSAGE_UPDATE event */
export async function updateMessageFromEvent(payload: {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  plaintext?: string;
  reply_to_id?: string;
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  const resolved = await resolvePlaintext(currentUserId, payload);

  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === payload.id);
    if (idx < 0) return prev;
    const existing = list[idx]!;
    const updated: DecryptedMessage = { ...existing, ...payload, ...resolved };
    return list.map((m, i) => (i === idx ? updated : m));
  });
}

/** Remove a message from local store (Stargate MESSAGE_DELETE) */
export function removeMessageFromEvent(roomId: string, messageId: string) {
  setMessages('byRoom', roomId, (prev) => (prev ?? []).filter((m) => m.id !== messageId));
}

/**
 * Apply one reaction delta (one user added/removed one emoji) to a message's aggregated
 * summary in place. Only used for events about *other* users - the current user's own
 * add/remove goes through toggleReaction below, which applies its own optimistic delta and
 * then reconciles from the REST response's authoritative summary; applying this same delta
 * again from that action's own MESSAGE_REACTION_ADD/REMOVE echo would double-count it.
 */
function patchReaction(roomId: string, messageId: string, emoji: string, userId: string, added: boolean) {
  const currentUserId = auth.user?.id;
  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    if (idx < 0) return prev;
    const msg = list[idx]!;
    const reactions = msg.reactions ?? [];
    const ri = reactions.findIndex((r) => r.emoji === emoji);
    let next: MessageReaction[];
    if (added) {
      next =
        ri >= 0
          ? reactions.map((r, i) => (i === ri ? { ...r, count: r.count + 1, me: r.me || userId === currentUserId } : r))
          : [...reactions, { emoji, count: 1, me: userId === currentUserId }];
    } else {
      if (ri < 0) return prev;
      const r = reactions[ri]!;
      const count = r.count - 1;
      next =
        count <= 0
          ? reactions.filter((_, i) => i !== ri)
          : reactions.map((rr, i) => (i === ri ? { ...rr, count, me: userId === currentUserId ? false : rr.me } : rr));
    }
    return list.map((m, i) => (i === idx ? { ...m, reactions: next } : m));
  });
}

/**
 * Toggle the current user's own reaction: applies an optimistic delta immediately, calls
 * the API, then replaces the message's reaction summary with the authoritative one the
 * response carries. Reverts the optimistic delta if the request fails.
 */
export async function toggleReaction(roomId: string, messageId: string, emoji: string, currentlyMine: boolean): Promise<void> {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  patchReaction(roomId, messageId, emoji, currentUserId, !currentlyMine);
  try {
    const res = currentlyMine
      ? await removeReactionApi(roomId, messageId, emoji)
      : await addReactionApi(roomId, messageId, emoji);
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx < 0) return prev;
      return list.map((m, i) => (i === idx ? { ...m, reactions: res.reactions } : m));
    });
  } catch (err) {
    patchReaction(roomId, messageId, emoji, currentUserId, currentlyMine);
    throw err;
  }
}

/** Edit a message: encrypt, PATCH, update local store. Realtime MESSAGE_UPDATE will also update others. */
export async function editMessage(
  roomId: string,
  msgId: string,
  newPlaintext: string
): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;

  const participants = room.participants ?? [];
  const otherParticipant = participants.find((p) => p.id !== currentUserId);
  const isNotesRoom = !otherParticipant && participants.length === 1;
  const isGroupRoom = room.type === 2 && participants.length >= 2;
  const isSpaceTextRoom = room.type === 3;
  if (!otherParticipant && !isNotesRoom && !isGroupRoom && !isSpaceTextRoom) return null;

  try {
    await ensureDevice(currentUserId);
    const e2eeOff = roomE2EEOff(room, isGroupRoom, isSpaceTextRoom);
    const existing = messages.byRoom[roomId]?.find((m) => m.id === msgId);
    // An E2EE edit re-encrypts the whole body, so the attachment metadata/keys that live
    // in it have to be carried over or every other reader would lose the files.
    const encryptedMetas = (existing?.attachments ?? [])
      .map(encryptedMetaFromView)
      .filter((m): m is EncryptedAttachmentMeta => m != null);

    const msg = e2eeOff
      ? await editMessageApi(roomId, msgId, { plaintext: newPlaintext })
      : await editMessageApi(roomId, msgId, {
          ciphertext: await encryptMessage(
            currentUserId,
            roomId,
            await resolveMemberUserIds(currentUserId, room, participants, isSpaceTextRoom),
            newPlaintext,
            encryptedMetas.length > 0 ? { attachments: encryptedMetas } : undefined
          ),
        });

    const updated: DecryptedMessage = {
      ...msg,
      plaintext: newPlaintext,
      notEncrypted: e2eeOff,
      attachments: existing?.attachments ?? (msg.attachments ?? []).filter((a) => !a.encrypted).map(viewFromServerAttachment),
    };
    setMessages('byRoom', roomId, (prev) => {
      const list = prev ?? [];
      const idx = list.findIndex((m) => m.id === msgId);
      if (idx < 0) return prev;
      return list.map((m, i) => (i === idx ? { ...m, ...updated } : m));
    });
    return msg;
  } catch (err) {
    console.error('Edit message failed:', err);
    throw err;
  }
}

/**
 * Bump the local mention badge when an incoming message pings the current user - the
 * server already incremented room_mention_counts (so a reload/other device sees it
 * regardless), this just makes the sidebar react immediately without waiting for one.
 * Mirrors the server's own notify-set rule (messages.Service.resolveMentionNotifySet):
 * direct mention OR @everyone/@here, never for your own messages.
 */
function applyIncomingMentionSignal(roomId: string, data: Record<string, unknown>) {
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  const senderId = data.sender_id != null ? String(data.sender_id) : '';
  if (senderId === currentUserId) return;
  const mentions = Array.isArray(data.mentions) ? (data.mentions as unknown[]).map(String) : [];
  const everyone = data.mention_everyone === true;
  if (!everyone && !mentions.includes(currentUserId)) return;
  setReadState('byRoom', roomId, (prev) => ({
    lastReadMessageId: prev?.lastReadMessageId ?? null,
    mentionCount: (prev?.mentionCount ?? 0) + 1,
  }));
}

/** Register Stargate event handlers. Call once on app init. */
export function initStargateMessageHandler() {
  return onStargateEvent((evt) => {
    if (evt.t === 'MESSAGE_CREATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      if (data && roomId) {
        const rawMsgId = data?.id;
        const msgId = rawMsgId != null ? String(rawMsgId) : '';
        // Notify once the message (and, in E2EE rooms, its plaintext) is in the store.
        void addMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof addMessageFromEvent>[0]).then(() => {
          if (msgId) maybeNotifyMessage(roomId, msgId);
        });
        applyIncomingMentionSignal(roomId, data);
        if (msgId) {
          updateRoomLastMessage(roomId, msgId);
          updateSpaceRoomLastMessage(roomId, msgId);
        }
      }
    } else if (evt.t === 'MESSAGE_UPDATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      if (data && roomId) {
        updateMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof updateMessageFromEvent>[0]);
      }
    } else if (evt.t === 'MESSAGE_DELETE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const rawRoomId = data?.room_id ?? (evt as { room_id?: string | number }).room_id;
      const roomId = rawRoomId != null ? String(rawRoomId) : '';
      const rawMessageId = data?.message_id ?? (data as { id?: string | number }).id;
      const messageId = rawMessageId != null ? String(rawMessageId) : '';
      if (roomId && messageId) {
        removeMessageFromEvent(roomId, messageId);
      }
    } else if (evt.t === 'MESSAGE_REACTION_ADD' || evt.t === 'MESSAGE_REACTION_REMOVE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = data?.room_id != null ? String(data.room_id) : '';
      const messageId = data?.message_id != null ? String(data.message_id) : '';
      const userId = data?.user_id != null ? String(data.user_id) : '';
      const emoji = typeof data?.emoji === 'string' ? data.emoji : '';
      // Our own reactions are already applied (optimistically, then reconciled) by
      // toggleReaction - applying this echo too would double-count them.
      if (roomId && messageId && userId && emoji && userId !== auth.user?.id) {
        patchReaction(roomId, messageId, emoji, userId, evt.t === 'MESSAGE_REACTION_ADD');
      }
    }
  });
}
