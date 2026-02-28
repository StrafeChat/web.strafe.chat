import { createStore } from 'solid-js/store';
import { listMessages, createMessage, editMessage as editMessageApi, type Message } from '../api/messages';
import { listDevices } from '../api/devices';
import {
  ensureDevice,
  getOrCreateSession,
  encryptMessage,
  encryptMessageForSelf,
  decryptMessage,
} from '../lib/e2ee';
import { PLAINTEXT_PREFIX, DUAL_CIPHERTEXT_PREFIX, GROUP_CIPHERTEXT_PREFIX } from '../lib/e2ee/constants';
import type { GroupCipherPayload } from '../lib/e2ee/types';
import { getDeviceIdentity, setSentPlaintext, getSentPlaintext } from '../lib/e2ee/store';
import { removeTyping } from './typing';
import { auth } from './auth';
import { rooms, updateRoomLastMessage } from './rooms';
import { onStargateEvent } from '../services/stargate/client';

const SENT_PLAINTEXT_PLACEHOLDER = '[Your message]';

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

export interface DecryptedMessage extends Message {
  plaintext?: string;
  decryptError?: boolean;
  /** True when message was sent without E2EE (recipient had no devices) */
  notEncrypted?: boolean;
  /** True when message is optimistic (not yet confirmed by server) */
  pending?: boolean;
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

const MESSAGES_PAGE_SIZE = 50;

export async function loadMessages(
  roomId: string,
  before?: string,
  getScrollContainer?: () => HTMLDivElement | undefined
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
        if (m.ciphertext.startsWith(PLAINTEXT_PREFIX)) {
          return { ...m, plaintext: m.ciphertext.slice(PLAINTEXT_PREFIX.length), notEncrypted: true };
        }
        if (m.ciphertext.startsWith(GROUP_CIPHERTEXT_PREFIX)) {
          try {
            const group = JSON.parse(
              m.ciphertext.slice(GROUP_CIPHERTEXT_PREFIX.length)
            ) as GroupCipherPayload;
            const isSender = String(m.sender_id) === currentUserId;
            if (isSender) {
              const stored = await getSentPlaintext(m.id);
              if (stored != null) return { ...m, plaintext: stored };
              if (group.s) {
                const plaintext = await decryptMessage(group.s, currentUserId);
                return { ...m, plaintext };
              }
              return { ...m, plaintext: SENT_PLAINTEXT_PLACEHOLDER };
            }
            const myDeviceId = (await getDeviceIdentity(currentUserId))?.deviceId;
            const forMeSlots = group.recipients?.filter((r) => r.user_id === currentUserId) ?? [];
            for (const slot of forMeSlots) {
              if (myDeviceId != null && slot.device_id !== myDeviceId) continue;
              try {
                const plaintext = await decryptMessage(slot.ciphertext, currentUserId);
                return { ...m, plaintext };
              } catch {
                continue;
              }
            }
            for (const slot of forMeSlots) {
              if (myDeviceId != null && slot.device_id === myDeviceId) continue;
              try {
                const plaintext = await decryptMessage(slot.ciphertext, currentUserId);
                return { ...m, plaintext };
              } catch {
                continue;
              }
            }
            return { ...m, decryptError: true };
          } catch (e) {
            console.error('[E2EE] Group decrypt failed for message', m.id, e);
            return { ...m, decryptError: true };
          }
        }
        if (String(m.sender_id) === auth.user?.id) {
          const stored = await getSentPlaintext(m.id);
          if (stored != null) return { ...m, plaintext: stored };
          if (m.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)) {
            try {
              const dual = JSON.parse(
                m.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
              ) as { s?: string };
              if (dual.s) {
                const plaintext = await decryptMessage(dual.s, currentUserId);
                return { ...m, plaintext };
              }
            } catch {
              // fall through to placeholder
            }
          } else {
            // Notes room: ciphertext is self-encrypted only (no dual wrapper)
            try {
              const plaintext = await decryptMessage(m.ciphertext, currentUserId);
              return { ...m, plaintext };
            } catch {
              // fall through to placeholder
            }
          }
          return { ...m, plaintext: SENT_PLAINTEXT_PLACEHOLDER };
        }
        try {
          let toDecrypt = m.ciphertext;
          if (m.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)) {
            const dual = JSON.parse(
              m.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
            ) as { r?: string };
            toDecrypt = dual.r ?? m.ciphertext;
          }
          const plaintext = await decryptMessage(toDecrypt, currentUserId);
          return { ...m, plaintext };
        } catch (e) {
          console.error('[E2EE] Decrypt failed for message', m.id, 'from', m.sender_id, e);
          return { ...m, decryptError: true };
        }
      })
    );
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
    if (isInitialLoad && decrypted.length > 0) {
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
  replyToId?: string
): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;

  const participants = room.participants ?? [];
  const otherParticipant = participants.find((p) => p.id !== currentUserId);
  const isNotesRoom = !otherParticipant && participants.length === 1;
  const isGroupRoom = room.type === 2 && participants.length >= 2;
  if (!otherParticipant && !isNotesRoom && !isGroupRoom) return null;

  const nonce = createTempId();
  const now = new Date().toISOString();
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
  };

  setMessages('byRoom', roomId, (prev) => sortByCreatedAt([...(prev ?? []), tempMsg]));
  setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);

  setMessages('sending', roomId, true);
  try {
    await ensureDevice(currentUserId);
    let ciphertext: string;
    let notEncrypted = false;

    if (isGroupRoom) {
      const others = participants.filter((p) => p.id !== currentUserId);
      const recipients: GroupCipherPayload['recipients'] = [];
      for (const p of others) {
        try {
          const devices = await listDevices(p.id);
          for (const d of devices) {
            const deviceId = d.device_id;
            await getOrCreateSession(currentUserId, p.id, deviceId);
            const c = await encryptMessage(plaintext, currentUserId, p.id, deviceId);
            recipients.push({ user_id: p.id, device_id: deviceId, ciphertext: c });
          }
        } catch (e) {
          console.warn('[E2EE] Group: could not encrypt for', p.id, e);
        }
      }
      const senderCipher = await encryptMessageForSelf(plaintext, currentUserId);
      if (recipients.length === 0) {
        ciphertext = PLAINTEXT_PREFIX + plaintext;
        notEncrypted = true;
      } else {
        ciphertext =
          GROUP_CIPHERTEXT_PREFIX +
          JSON.stringify({ s: senderCipher, recipients });
      }
    } else {
      const recipientId = otherParticipant?.id ?? currentUserId;
      const devices = await listDevices(recipientId);
      const deviceId = devices[0]?.device_id;

      if (deviceId != null) {
        await getOrCreateSession(currentUserId, recipientId, deviceId);
        if (isNotesRoom) {
          ciphertext = await encryptMessageForSelf(plaintext, currentUserId);
        } else {
          const recipientCipher = await encryptMessage(
            plaintext,
            currentUserId,
            recipientId,
            deviceId
          );
          const senderCipher = await encryptMessageForSelf(plaintext, currentUserId);
          ciphertext =
            DUAL_CIPHERTEXT_PREFIX +
            JSON.stringify({ r: recipientCipher, s: senderCipher });
        }
      } else {
        ciphertext = PLAINTEXT_PREFIX + plaintext;
        notEncrypted = true;
      }
    }

    const device = await getDeviceIdentity(currentUserId);
    const msg = await createMessage(roomId, {
      sender_device_id: device?.deviceId ?? 1,
      ciphertext,
      ...(replyToId ? { reply_to_id: Number(replyToId) } : {}),
    });

    await setSentPlaintext(msg.id, plaintext);

    const confirmed: DecryptedMessage = { ...msg, plaintext, notEncrypted };
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
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  removeTyping(roomId, String(payload.sender_id));
  const currentUserId = auth.user?.id;
  if (currentUserId) {
    try {
      await ensureDevice(currentUserId);
    } catch {
      // fall through; decrypt will fail and we'll set decryptError
    }
  }
  let plaintext: string | undefined;
  let decryptError = false;
  let notEncrypted = false;

  if (payload.ciphertext.startsWith(PLAINTEXT_PREFIX)) {
    plaintext = payload.ciphertext.slice(PLAINTEXT_PREFIX.length);
    notEncrypted = true;
  } else if (payload.ciphertext.startsWith(GROUP_CIPHERTEXT_PREFIX) && currentUserId) {
    try {
      const group = JSON.parse(
        payload.ciphertext.slice(GROUP_CIPHERTEXT_PREFIX.length)
      ) as GroupCipherPayload;
      const isSender = String(payload.sender_id) === currentUserId;
      if (isSender) {
        const stored = await getSentPlaintext(payload.id);
        if (stored != null) plaintext = stored;
        else if (group.s) plaintext = await decryptMessage(group.s, currentUserId);
        else plaintext = SENT_PLAINTEXT_PLACEHOLDER;
      } else {
        const myDeviceId = (await getDeviceIdentity(currentUserId))?.deviceId;
        const forMeSlots = group.recipients?.filter((r) => r.user_id === currentUserId) ?? [];
        for (const slot of forMeSlots) {
          if (myDeviceId != null && slot.device_id !== myDeviceId) continue;
          try {
            plaintext = await decryptMessage(slot.ciphertext, currentUserId);
            break;
          } catch {
            continue;
          }
        }
        if (plaintext == null) {
          for (const slot of forMeSlots) {
            if (myDeviceId != null && slot.device_id === myDeviceId) continue;
            try {
              plaintext = await decryptMessage(slot.ciphertext, currentUserId);
              break;
            } catch {
              continue;
            }
          }
        }
        if (plaintext == null) decryptError = true;
      }
    } catch (e) {
      console.error('[E2EE] Group decrypt failed for real-time message', payload.id, e);
      decryptError = true;
    }
  } else if (String(payload.sender_id) !== currentUserId && currentUserId) {
    try {
      let toDecrypt = payload.ciphertext;
      if (payload.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)) {
        const dual = JSON.parse(
          payload.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
        ) as { r?: string };
        toDecrypt = dual.r ?? payload.ciphertext;
      }
      plaintext = await decryptMessage(toDecrypt, currentUserId);
    } catch (e) {
      console.error('[E2EE] Decrypt failed for real-time message', payload.id, 'from', payload.sender_id, e);
      decryptError = true;
    }
  } else {
    const stored = await getSentPlaintext(payload.id);
    if (stored != null) {
      plaintext = stored;
    } else if (
      currentUserId &&
      payload.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)
    ) {
      try {
        const dual = JSON.parse(
          payload.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
        ) as { s?: string };
        if (dual.s) {
          plaintext = await decryptMessage(dual.s, currentUserId);
        } else {
          plaintext = SENT_PLAINTEXT_PLACEHOLDER;
        }
      } catch {
        plaintext = SENT_PLAINTEXT_PLACEHOLDER;
      }
    } else if (currentUserId && !payload.ciphertext.startsWith(PLAINTEXT_PREFIX) && !payload.ciphertext.startsWith(GROUP_CIPHERTEXT_PREFIX)) {
      // Notes room: ciphertext is self-encrypted only
      try {
        plaintext = await decryptMessage(payload.ciphertext, currentUserId);
      } catch {
        plaintext = SENT_PLAINTEXT_PLACEHOLDER;
      }
    } else {
      plaintext = SENT_PLAINTEXT_PLACEHOLDER;
    }
  }
  const msg: DecryptedMessage = {
    ...payload,
    plaintext: plaintext ?? SENT_PLAINTEXT_PLACEHOLDER,
    decryptError: decryptError || undefined,
    notEncrypted,
  };
  let didReplaceInPlace = false;
  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      didReplaceInPlace = true;
      const existing = list[existingIdx]!;
      return list.map((m, i) =>
        i === existingIdx
          ? {
              ...existing,
              ...msg,
              plaintext:
                msg.plaintext && msg.plaintext !== SENT_PLAINTEXT_PLACEHOLDER ? msg.plaintext : existing.plaintext,
            }
          : m
      );
    }
    const isOwn = String(payload.sender_id) === currentUserId;
    const tempIdx =
      isOwn && plaintext
        ? list.findIndex(
            (m) =>
              m.pending &&
              m.sender_id === payload.sender_id &&
              m.plaintext === plaintext
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
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
}) {
  const roomId = payload.room_id;
  const currentUserId = auth.user?.id;
  if (!currentUserId) return;
  let plaintext: string | undefined;
  let decryptError = false;
  let notEncrypted = false;

  if (payload.ciphertext.startsWith(PLAINTEXT_PREFIX)) {
    plaintext = payload.ciphertext.slice(PLAINTEXT_PREFIX.length);
    notEncrypted = true;
  } else if (payload.ciphertext.startsWith(GROUP_CIPHERTEXT_PREFIX) && currentUserId) {
    try {
      const group = JSON.parse(
        payload.ciphertext.slice(GROUP_CIPHERTEXT_PREFIX.length)
      ) as GroupCipherPayload;
      const isSender = String(payload.sender_id) === currentUserId;
      if (isSender) {
        const stored = await getSentPlaintext(payload.id);
        if (stored != null) plaintext = stored;
        else if (group.s) plaintext = await decryptMessage(group.s, currentUserId);
        else plaintext = SENT_PLAINTEXT_PLACEHOLDER;
      } else {
        const myDeviceId = (await getDeviceIdentity(currentUserId))?.deviceId;
        const forMeSlots = group.recipients?.filter((r) => r.user_id === currentUserId) ?? [];
        for (const slot of forMeSlots) {
          if (myDeviceId != null && slot.device_id !== myDeviceId) continue;
          try {
            plaintext = await decryptMessage(slot.ciphertext, currentUserId);
            break;
          } catch {
            continue;
          }
        }
        if (plaintext == null) decryptError = true;
      }
    } catch {
      decryptError = true;
    }
  } else if (String(payload.sender_id) !== currentUserId && currentUserId) {
    try {
      let toDecrypt = payload.ciphertext;
      if (payload.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)) {
        const dual = JSON.parse(
          payload.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
        ) as { r?: string };
        toDecrypt = dual.r ?? payload.ciphertext;
      }
      plaintext = await decryptMessage(toDecrypt, currentUserId);
    } catch {
      decryptError = true;
    }
  } else {
    const stored = await getSentPlaintext(payload.id);
    if (stored != null) plaintext = stored;
    else if (currentUserId && payload.ciphertext.startsWith(DUAL_CIPHERTEXT_PREFIX)) {
      try {
        const dual = JSON.parse(
          payload.ciphertext.slice(DUAL_CIPHERTEXT_PREFIX.length)
        ) as { s?: string };
        plaintext = dual.s ? await decryptMessage(dual.s, currentUserId) : SENT_PLAINTEXT_PLACEHOLDER;
      } catch {
        plaintext = SENT_PLAINTEXT_PLACEHOLDER;
      }
    } else {
      plaintext = SENT_PLAINTEXT_PLACEHOLDER;
    }
  }

  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === payload.id);
    if (idx < 0) return prev;
    const existing = list[idx]!;
    const updated: DecryptedMessage = {
      ...existing,
      ...payload,
      plaintext: plaintext ?? SENT_PLAINTEXT_PLACEHOLDER,
      decryptError: decryptError || undefined,
      notEncrypted,
    };
    return list.map((m, i) => (i === idx ? updated : m));
  });
}

/** Remove a message from local store (Stargate MESSAGE_DELETE) */
export function removeMessageFromEvent(roomId: string, messageId: string) {
  setMessages('byRoom', roomId, (prev) => (prev ?? []).filter((m) => m.id !== messageId));
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
  if (!otherParticipant && !isNotesRoom && !isGroupRoom) return null;

  try {
    await ensureDevice(currentUserId);
    let ciphertext: string;
    let notEncrypted = false;

    if (isGroupRoom) {
      const others = participants.filter((p) => p.id !== currentUserId);
      const recipients: GroupCipherPayload['recipients'] = [];
      for (const p of others) {
        try {
          const devices = await listDevices(p.id);
          for (const d of devices) {
            const deviceId = d.device_id;
            await getOrCreateSession(currentUserId, p.id, deviceId);
            const c = await encryptMessage(newPlaintext, currentUserId, p.id, deviceId);
            recipients.push({ user_id: p.id, device_id: deviceId, ciphertext: c });
          }
        } catch (e) {
          console.warn('[E2EE] Group edit: could not encrypt for', p.id, e);
        }
      }
      const senderCipher = await encryptMessageForSelf(newPlaintext, currentUserId);
      if (recipients.length === 0) {
        ciphertext = PLAINTEXT_PREFIX + newPlaintext;
        notEncrypted = true;
      } else {
        ciphertext =
          GROUP_CIPHERTEXT_PREFIX +
          JSON.stringify({ s: senderCipher, recipients });
      }
    } else {
      const recipientId = otherParticipant?.id ?? currentUserId;
      const devices = await listDevices(recipientId);
      const deviceId = devices[0]?.device_id;

      if (deviceId != null) {
        await getOrCreateSession(currentUserId, recipientId, deviceId);
        if (isNotesRoom) {
          ciphertext = await encryptMessageForSelf(newPlaintext, currentUserId);
        } else {
          const recipientCipher = await encryptMessage(
            newPlaintext,
            currentUserId,
            recipientId,
            deviceId
          );
          const senderCipher = await encryptMessageForSelf(newPlaintext, currentUserId);
          ciphertext =
            DUAL_CIPHERTEXT_PREFIX +
            JSON.stringify({ r: recipientCipher, s: senderCipher });
        }
      } else {
        ciphertext = PLAINTEXT_PREFIX + newPlaintext;
        notEncrypted = true;
      }
    }

    const msg = await editMessageApi(roomId, msgId, ciphertext);
    await setSentPlaintext(msg.id, newPlaintext);

    const updated: DecryptedMessage = { ...msg, plaintext: newPlaintext, notEncrypted };
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

/** Register Stargate event handlers. Call once on app init. */
export function initStargateMessageHandler() {
  return onStargateEvent((evt) => {
    if (evt.t === 'MESSAGE_CREATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = data?.room_id ?? (evt as { room_id?: string }).room_id;
      if (data && typeof roomId === 'string') {
        addMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof addMessageFromEvent>[0]);
        const msgId = data?.id;
        if (typeof msgId === 'string') updateRoomLastMessage(roomId, msgId);
      }
    } else if (evt.t === 'MESSAGE_UPDATE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = data?.room_id ?? (evt as { room_id?: string }).room_id;
      if (data && typeof roomId === 'string') {
        updateMessageFromEvent({ ...data, room_id: roomId } as Parameters<typeof updateMessageFromEvent>[0]);
      }
    } else if (evt.t === 'MESSAGE_DELETE') {
      const payload = (evt.d as Record<string, unknown>)?.d ?? evt.d;
      const data = payload as Record<string, unknown>;
      const roomId = data?.room_id ?? (evt as { room_id?: string }).room_id;
      const messageId = data?.message_id ?? (data as { id?: string }).id;
      if (typeof roomId === 'string' && typeof messageId === 'string') {
        removeMessageFromEvent(roomId, messageId);
      }
    }
  });
}
