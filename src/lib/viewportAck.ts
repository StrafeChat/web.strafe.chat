import { createEffect, createSignal, onCleanup, onMount, type Accessor } from 'solid-js';
import { ackRoomOptimistic, messageIdGt, readState } from '../stores/readState';
import { rooms } from '../stores/rooms';
import { messages } from '../stores/messages';
import { clearPendingAck, getPendingAck, setPendingAck } from '../stores/pendingAck';
import { ackRoomKeepalive } from '../api/rooms';

/** Newest real (snowflake) message id loaded for a room, skipping optimistic temp ids. The
 * list is time-ordered, but a just-sent pending message can sit at the tail, so scan for the
 * max rather than trusting the last element. */
function newestLoadedMessageId(roomId: string): string | null {
  const list = messages.byRoom[roomId];
  if (!list) return null;
  let best: string | null = null;
  for (const m of list) {
    if (!/^\d+$/.test(m.id)) continue;
    if (best == null || messageIdGt(m.id, best)) best = m.id;
  }
  return best;
}

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
    let ackID = bottomVisibleMessageId();
    // Tracked so this re-runs once the room's messages finish loading, which is the only
    // signal an empty room gives (it never reports a bottom-visible message).
    const loaded = id ? messages.byRoom[id] : undefined;
    const loading = id ? messages.loading[id] === true : false;
    if (!id) {
      clearPendingAck();
      return;
    }
    if (!ackID || !/^\d+$/.test(ackID)) {
      // An empty room (its messages were all deleted) has nothing to ack, yet may still claim
      // a last_message_id above our read cursor - a permanent phantom unread. Once it has
      // finished loading and there is nothing more to page in either way, ack straight to that
      // id so the badge clears for good.
      const r = rooms.rooms.find((x) => x.id === id);
      const roomLast = r?.last_message_id;
      const trulyEmpty = !loading && (loaded?.length ?? 0) === 0 && messages.hasMoreOlder[id] !== true && messages.hasMoreNewer[id] !== true;
      if (roomLast && /^\d+$/.test(roomLast) && trulyEmpty) {
        ackID = roomLast;
      } else {
        clearPendingAck();
        return;
      }
    }
    const room = rooms.rooms.find((r) => r.id === id);
    // Heal a dangling last_message_id: when the room's newest message is deleted the server
    // leaves last_message_id pointing at the gone row, and the cursor can never reach it - the
    // sidebar then shows a permanent unread that only clears while you're inside the room. If
    // the acked message is the newest one actually loaded (you're at the live tail) but the room
    // still claims a higher last_message_id, advance the cursor all the way to it so the phantom
    // clears for good. At the tail this is also just Discord's "ack the channel's last message".
    // Not while reading a jumped-to window (hasMoreNewer): there the "newest loaded" is the
    // window's newest, not the live tail, so healing up to last_message_id would wrongly mark
    // the whole room read before the user has scrolled down to the real newest.
    const roomLast = room?.last_message_id;
    if (
      roomLast &&
      /^\d+$/.test(roomLast) &&
      messages.hasMoreNewer[id] !== true &&
      messageIdGt(roomLast, ackID) &&
      ackID === newestLoadedMessageId(id)
    ) {
      ackID = roomLast;
    }
    const lastRead =
      readState.byRoom[id]?.lastReadMessageId ??
      room?.last_read_message_id ??
      null;
    if (lastRead && !messageIdGt(ackID, lastRead)) {
      // Caught up on messages, so there is nothing newer to ack. Normally we stop here - but a
      // STRANDED mention badge (its message was deleted, leaving nothing to advance the cursor
      // to) must still be cleared, or it is permanent. Re-ack at the current cursor: the server
      // treats a non-advancing ack as "reset the mention baseline" without moving the cursor.
      if ((readState.byRoom[id]?.mentionCount ?? 0) === 0) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      ackRoomOptimistic(id, lastRead);
      return;
    }
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
