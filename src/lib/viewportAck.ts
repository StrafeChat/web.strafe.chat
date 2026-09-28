import { createEffect, createSignal, onCleanup, onMount, type Accessor } from 'solid-js';
import { ackRoomOptimistic, messageIdGt, readState } from '../stores/readState';
import { rooms } from '../stores/rooms';
import { clearPendingAck, getPendingAck, setPendingAck } from '../stores/pendingAck';
import { ackRoomKeepalive } from '../api/rooms';

/**
 * Viewport-driven read cursor for whichever room a page is showing. MessageList reports
 * the bottom-most message actually on screen (debounced); this advances the read cursor
 * to it whenever it moves past what's already read, and keeps a pending ack around so a
 * refresh/close still lands the last position via a keepalive request.
 *
 * Shared by RoomPage and SpacePage so the two can't drift apart again.
 *
 * Acks are skipped while the tab is hidden (nobody is looking), but re-evaluated the
 * moment it becomes visible or focused again - previously the effect only re-ran when the
 * reported message id changed, so a message that arrived while the tab was hidden stayed
 * unread until the user happened to scroll.
 */
export function createViewportAck(roomId: Accessor<string | undefined>) {
  const [bottomVisibleMessageId, setBottomVisibleMessageId] = createSignal<string | null>(null);
  const [visibilityTick, setVisibilityTick] = createSignal(0);

  // Reset when switching rooms. MessageList republishes ~450ms after mount, but without
  // this the effect below would re-run on room change while still holding the PREVIOUS
  // room's bottom-visible id and could ack the new room up to a message that isn't in it
  // (snowflakes are globally time-ordered, so a recent id from room A usually looks newer
  // than room B's cursor too).
  createEffect(() => {
    roomId();
    setBottomVisibleMessageId(null);
  });

  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setVisibilityTick((t) => t + 1);
    };
    const onBeforeUnload = () => {
      const p = getPendingAck();
      if (p) ackRoomKeepalive(p.roomId, p.messageId);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('beforeunload', onBeforeUnload);
    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('beforeunload', onBeforeUnload);
    });
  });

  createEffect(() => {
    visibilityTick();
    const id = roomId();
    const ackID = bottomVisibleMessageId();
    if (!id || !ackID || !/^\d+$/.test(ackID)) {
      clearPendingAck();
      return;
    }
    const lastRead =
      readState.byRoom[id]?.lastReadMessageId ??
      rooms.rooms.find((r) => r.id === id)?.last_read_message_id ??
      null;
    if (lastRead && !messageIdGt(ackID, lastRead)) return;
    setPendingAck(id, ackID);
    // Was document.hasFocus(), which requires OS-level window focus - anyone with two
    // accounts side by side in separate windows had the second window lose focus constantly
    // while genuinely watching messages arrive, silently blocking every ack. visibilityState
    // only cares whether this tab itself is hidden, which is what actually matters.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    ackRoomOptimistic(id, ackID);
  });

  onCleanup(() => clearPendingAck());

  return { bottomVisibleMessageId, setBottomVisibleMessageId };
}
