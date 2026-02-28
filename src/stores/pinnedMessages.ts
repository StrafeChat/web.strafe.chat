import { createStore } from 'solid-js/store';

interface PinnedMessagesState {
  byRoom: Record<string, string[]>;
}

function loadInitialState(): PinnedMessagesState {
  if (typeof window === 'undefined') {
    return { byRoom: {} };
  }
  try {
    const raw = window.localStorage.getItem('pinnedMessages');
    if (!raw) return { byRoom: {} };
    const parsed = JSON.parse(raw) as PinnedMessagesState;
    if (!parsed || typeof parsed !== 'object' || !parsed.byRoom) {
      return { byRoom: {} };
    }
    return { byRoom: parsed.byRoom ?? {} };
  } catch {
    return { byRoom: {} };
  }
}

export const [pinnedMessages, setPinnedMessages] = createStore<PinnedMessagesState>(
  loadInitialState()
);

function persist(state: PinnedMessagesState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('pinnedMessages', JSON.stringify(state));
  } catch {
    
  }
}

export function isMessagePinned(roomId: string | undefined, messageId: string): boolean {
  if (!roomId) return false;
  const list = pinnedMessages.byRoom[roomId] ?? [];
  return list.includes(messageId);
}

export function pinMessage(roomId: string | undefined, messageId: string) {
  if (!roomId) return;
  setPinnedMessages('byRoom', roomId, (prev = []) => {
    if (prev.includes(messageId)) return prev;
    const next = [...prev, messageId];
    queueMicrotask(() => persist({ byRoom: { ...pinnedMessages.byRoom, [roomId]: next } }));
    return next;
  });
}

export function unpinMessage(roomId: string | undefined, messageId: string) {
  if (!roomId) return;
  setPinnedMessages('byRoom', roomId, (prev = []) => {
    const next = prev.filter((id) => id !== messageId);
    queueMicrotask(() => persist({ byRoom: { ...pinnedMessages.byRoom, [roomId]: next } }));
    return next;
  });
}

export function clearPinnedForRoom(roomId: string | undefined) {
  if (!roomId) return;
  setPinnedMessages('byRoom', roomId, []);
  queueMicrotask(() => persist({ byRoom: { ...pinnedMessages.byRoom, [roomId]: [] } }));
}

