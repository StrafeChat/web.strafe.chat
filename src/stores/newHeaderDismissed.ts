import { createStore } from 'solid-js/store';

/** Separate from read state - tracks when user has "dismissed" the NEW header (e.g. by sending). */
export interface NewHeaderDismissedStore {
  byRoom: Record<string, boolean>;
}

export const [newHeaderDismissed, setNewHeaderDismissed] = createStore<NewHeaderDismissedStore>({
  byRoom: {},
});

export function dismissNewHeader(roomId: string) {
  setNewHeaderDismissed('byRoom', roomId, true);
}

export function clearNewHeaderDismissed(roomId: string) {
  setNewHeaderDismissed('byRoom', roomId, false);
}
