import { createStore } from 'solid-js/store';
import { listMessages, createMessage, type Message } from '../api/messages';
import { listDevices } from '../api/devices';
import { ensureDevice, getOrCreateSession, encryptMessage, decryptMessage } from '../lib/e2ee';
import { PLAINTEXT_PREFIX } from '../lib/e2ee/constants';
import { getDeviceIdentity, setSentPlaintext, getSentPlaintext } from '../lib/e2ee/store';
import { auth } from './auth';
import { rooms } from './rooms';
import { onStargateEvent } from '../services/stargate/client';

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
  sending: Record<string, boolean>;
}

export const [messages, setMessages] = createStore<MessagesState>({
  byRoom: {},
  loading: {},
  sending: {},
});

export async function loadMessages(roomId: string, before?: string) {
  setMessages('loading', roomId, true);
  try {
    const list = await listMessages(roomId, { before, limit: 50 });
    const decrypted = await Promise.all(
      list.map(async (m): Promise<DecryptedMessage> => {
        if (m.ciphertext.startsWith(PLAINTEXT_PREFIX)) {
          return { ...m, plaintext: m.ciphertext.slice(PLAINTEXT_PREFIX.length), notEncrypted: true };
        }
        if (m.sender_id === auth.user?.id) {
          const stored = await getSentPlaintext(m.id);
          return { ...m, plaintext: stored ?? '[Your message]' };
        }
        try {
          const plaintext = await decryptMessage(m.ciphertext);
          return { ...m, plaintext };
        } catch {
          return { ...m, decryptError: true };
        }
      })
    );
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
  } finally {
    setMessages('loading', roomId, false);
  }
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

  setMessages('sending', roomId, true);
  try {
    await ensureDevice();
    const devices = await listDevices(otherParticipant.id);
    const deviceId = devices[0]?.device_id;
    let ciphertext: string;
    let notEncrypted = false;

    if (deviceId != null) {
      await getOrCreateSession(otherParticipant.id, deviceId);
      ciphertext = await encryptMessage(plaintext, otherParticipant.id, deviceId);
    } else {
      ciphertext = PLAINTEXT_PREFIX + plaintext;
      notEncrypted = true;
    }

    const device = await getDeviceIdentity();
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
  let plaintext: string | undefined;
  let decryptError = false;
  let notEncrypted = false;

  if (payload.ciphertext.startsWith(PLAINTEXT_PREFIX)) {
    plaintext = payload.ciphertext.slice(PLAINTEXT_PREFIX.length);
    notEncrypted = true;
  } else if (payload.sender_id !== auth.user?.id) {
    try {
      plaintext = await decryptMessage(payload.ciphertext);
    } catch {
      decryptError = true;
    }
  } else {
    plaintext = (await getSentPlaintext(payload.id)) ?? '[Your message]';
  }
  const msg: DecryptedMessage = {
    ...payload,
    plaintext,
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
          msg.plaintext && msg.plaintext !== '[Your message]' ? msg.plaintext : existing.plaintext,
      };
      return sortByCreatedAt(merged);
    }
    return sortByCreatedAt([...list, msg]);
  });
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
