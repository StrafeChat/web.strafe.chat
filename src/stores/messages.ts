import { createStore } from 'solid-js/store';
import { listMessages, createMessage, type Message } from '../api/messages';
import { listDevices } from '../api/devices';
import {
  ensureDevice,
  getOrCreateSession,
  encryptMessage,
  encryptMessageForSelf,
  decryptMessage,
} from '../lib/e2ee';
import { PLAINTEXT_PREFIX, DUAL_CIPHERTEXT_PREFIX } from '../lib/e2ee/constants';
import { getDeviceIdentity, setSentPlaintext, getSentPlaintext } from '../lib/e2ee/store';
import { removeTyping } from './typing';
import { auth } from './auth';
import { rooms } from './rooms';
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

export async function sendMessage(roomId: string, plaintext: string): Promise<Message | null> {
  const room = rooms.rooms.find((r) => r.id === roomId);
  const currentUserId = auth.user?.id;
  if (!room || !currentUserId) return null;

  const otherParticipant = room.participants?.find((p) => p.id !== currentUserId);
  if (!otherParticipant) return null;

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
  };

  // Optimistic add – show message immediately (nonce pattern)
  setMessages('byRoom', roomId, (prev) => sortByCreatedAt([...(prev ?? []), tempMsg]));
  setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);

  setMessages('sending', roomId, true);
  try {
    await ensureDevice(currentUserId);
    const devices = await listDevices(otherParticipant.id);
    const deviceId = devices[0]?.device_id;
    let ciphertext: string;
    let notEncrypted = false;

    if (deviceId != null) {
      await getOrCreateSession(currentUserId, otherParticipant.id, deviceId);
      const recipientCipher = await encryptMessage(
        plaintext,
        currentUserId,
        otherParticipant.id,
        deviceId
      );
      const senderCipher = await encryptMessageForSelf(plaintext, currentUserId);
      ciphertext =
        DUAL_CIPHERTEXT_PREFIX +
        JSON.stringify({ r: recipientCipher, s: senderCipher });
    } else {
      ciphertext = PLAINTEXT_PREFIX + plaintext;
      notEncrypted = true;
    }

    const device = await getDeviceIdentity(currentUserId);
    const msg = await createMessage(roomId, {
      sender_device_id: device?.deviceId ?? 1,
      ciphertext,
    });

    await setSentPlaintext(msg.id, plaintext);

    setMessages('byRoom', roomId, (prev) => {
      const list = (prev ?? []).filter((m) => m.id !== nonce);
      const existing = list.find((m) => m.id === msg.id);
      const confirmed: DecryptedMessage = { ...msg, plaintext, notEncrypted };
      if (existing) {
        return sortByCreatedAt(
          list.map((m) => (m.id === msg.id ? { ...m, ...confirmed, plaintext } : m))
        );
      }
      return sortByCreatedAt([...list, confirmed]);
    });
    setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
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
  setMessages('byRoom', roomId, (prev) => {
    const list = prev ?? [];
    const idx = list.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      const existing = list[idx]!;
      const merged = [...list];
      merged[idx] = {
        ...existing,
        ...msg,
        plaintext:
          msg.plaintext && msg.plaintext !== SENT_PLAINTEXT_PLACEHOLDER ? msg.plaintext : existing.plaintext,
      };
      return sortByCreatedAt(merged);
    }
    return sortByCreatedAt([...list, msg]);
  });
  setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
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
      }
    }
  });
}
