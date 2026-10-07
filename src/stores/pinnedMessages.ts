import { createStore, produce } from 'solid-js/store';
import { listPins, pinMessageRequest, unpinMessageRequest } from '../api/messages';
import { onStargateEvent } from '../services/stargate/client';
import { decryptServerMessages, setMessagePinned, type DecryptedMessage } from './messages';

/**
 * A room's pinned messages as the server keeps them (GET /rooms/:id/pins): shared by everyone
 * in the room, the way Discord's are, instead of a per-browser list. Loaded once per room when
 * it is opened - so the header's pin icon knows whether there is anything to show - and kept
 * current by ROOM_PINS_UPDATE: the message's own `pinned` flag in the room list is patched at
 * once, and the list is refetched (a newly pinned message may not be in the loaded history).
 */
interface PinnedMessagesState {
  /** Newest pin first, decrypted for display like a history page. */
  byRoom: Record<string, DecryptedMessage[]>;
  loaded: Record<string, boolean>;
}

export const [pinnedMessages, setPinnedMessages] = createStore<PinnedMessagesState>({ byRoom: {}, loaded: {} });

const inflight = new Map<string, Promise<void>>();

/** Load a room's pin list the first time it is needed; later calls resolve at once. */
export function ensureRoomPins(roomId: string | undefined): Promise<void> {
  if (!roomId || pinnedMessages.loaded[roomId]) return Promise.resolve();
  return refreshRoomPins(roomId);
}

/** Re-read a room's pin list from the server (one request at a time per room). */
export function refreshRoomPins(roomId: string): Promise<void> {
  const running = inflight.get(roomId);
  if (running) return running;
  const p = (async () => {
    try {
      const res = await listPins(roomId);
      const decrypted = await decryptServerMessages(
        res.items.map((it) => ({ ...it.message, pinned: true, pinned_at: it.pinned_at, pinned_by: it.pinned_by }))
      );
      setPinnedMessages(
        produce((s) => {
          s.byRoom[roomId] = decrypted;
          s.loaded[roomId] = true;
        })
      );
    } catch (err) {
      console.error('Loading pinned messages failed:', err);
    } finally {
      inflight.delete(roomId);
    }
  })();
  inflight.set(roomId, p);
  return p;
}

export function isMessagePinned(roomId: string | undefined, messageId: string): boolean {
  if (!roomId) return false;
  return (pinnedMessages.byRoom[roomId] ?? []).some((m) => m.id === messageId);
}

/** Pin for everyone in the room. The flag flips at once; the server's ROOM_PINS_UPDATE echo
 * refreshes the list (and the flag is reverted if the request is refused). */
export async function pinMessage(roomId: string | undefined, messageId: string): Promise<void> {
  if (!roomId) return;
  setMessagePinned(roomId, messageId, true);
  try {
    await pinMessageRequest(roomId, messageId);
  } catch (err) {
    setMessagePinned(roomId, messageId, false);
    throw err;
  }
}

export async function unpinMessage(roomId: string | undefined, messageId: string): Promise<void> {
  if (!roomId) return;
  setPinnedMessages('byRoom', roomId, (prev = []) => prev.filter((m) => m.id !== messageId));
  setMessagePinned(roomId, messageId, false);
  try {
    await unpinMessageRequest(roomId, messageId);
  } catch (err) {
    void refreshRoomPins(roomId);
    throw err;
  }
}

/** ROOM_PINS_UPDATE and MESSAGE_DELETE keep every client's list in step with the room. */
export function initPinHandlers(): () => void {
  return onStargateEvent((evt) => {
    if (evt.t !== 'ROOM_PINS_UPDATE' && evt.t !== 'MESSAGE_DELETE') return;
    const data = ((evt.d as Record<string, unknown> | undefined)?.d ?? evt.d) as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') return;
    const roomId = data.room_id != null ? String(data.room_id) : '';
    const messageId = data.message_id != null ? String(data.message_id) : '';
    if (!roomId || !messageId) return;
    if (evt.t === 'MESSAGE_DELETE') {
      setPinnedMessages('byRoom', roomId, (prev = []) => prev.filter((m) => m.id !== messageId));
      return;
    }
    const pinned = data.pinned === true;
    setMessagePinned(
      roomId,
      messageId,
      pinned,
      typeof data.pinned_at === 'string' ? data.pinned_at : undefined,
      data.user_id != null ? String(data.user_id) : undefined
    );
    if (!pinned) {
      setPinnedMessages('byRoom', roomId, (prev = []) => prev.filter((m) => m.id !== messageId));
    }
    // The pinned message may not be in the loaded history, so the list is re-read rather than
    // patched; a room whose pins were never loaded loads them when it is next opened.
    if (pinnedMessages.loaded[roomId]) void refreshRoomPins(roomId);
  });
}
