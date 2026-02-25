import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show, onCleanup } from 'solid-js';
import type { DecryptedMessage } from '../stores/messages';
import { messages } from '../stores/messages';
import type { RoomParticipant } from '../api/rooms';
import { auth } from '../stores/auth';
import { settings } from '../stores/settings';
import { formatMessageTimestamp, formatDateHeader } from '../lib/utils/datetime';

const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;
const SCROLL_NEAR_BOTTOM_THRESHOLD = 150;
const SCROLL_LOAD_OLDER_THRESHOLD = 100;
const SCROLL_TO_BOTTOM_DELAY_MS = 100;
const IO_OBSERVE_DELAY_MS = 0;
const DECRYPT_ERROR_PLACEHOLDER = '[Unable to decrypt]';
const LOADING_PLACEHOLDER = '...';

function getMessageBodyText(msg: DecryptedMessage): string {
  if (msg.plaintext != null) return msg.plaintext;
  if (msg.decryptError) return DECRYPT_ERROR_PLACEHOLDER;
  return LOADING_PLACEHOLDER;
}

function getSenderDisplay(
  senderId: string,
  participants?: RoomParticipant[],
  currentUserId?: string
): { name: string; avatar?: string } {
  if (senderId === currentUserId) {
    return {
      name: auth.user?.display_name || auth.user?.username || 'You',
      avatar: undefined,
    };
  }
  const p = participants?.find((x) => x.id === senderId);
  return {
    name: p?.display_name || p?.username || 'Unknown',
    avatar: p?.avatar,
  };
}

function Avatar(props: { name: string; avatar?: string; class?: string }) {
  return (
    <div
      class={`shrink-0 rounded-full flex items-center justify-center text-sm font-medium bg-primary/20 text-foreground ${props.class ?? 'size-10'}`}
    >
      {props.avatar ? (
        <img src={props.avatar} alt="" class="size-full rounded-full object-cover" />
      ) : (
        (props.name?.[0] ?? '?').toUpperCase()
      )}
    </div>
  );
}

export interface MessageListProps {
  messages: DecryptedMessage[];
  roomId?: string;
  participants?: RoomParticipant[];
  compact?: boolean;
  loadingOlder?: boolean;
  hasMoreOlder?: boolean;
  onLoadOlder?: (getScrollContainer: () => HTMLDivElement | undefined) => void;
}

export const MessageList: Component<MessageListProps> = (props) => {
  const listRef = createSignal<HTMLDivElement>();
  const sentinelRef = createSignal<HTMLDivElement>();
  const isNearBottom = createSignal(true);
  const getScrollContainer = () => listRef[0]?.();
  const currentUserId = () => auth.user?.id;
  const compact = () => props.compact !== undefined ? props.compact : settings.messageCompact;

  // Track whether user is near bottom (for auto-scroll decision) and load older when near top
  createEffect(() => {
    const el = listRef[0]?.();
    const roomId = props.roomId;
    const onLoad = props.onLoadOlder;
    if (!el || !roomId || !onLoad) return;
    const onScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = el;
      const near =
        scrollHeight - scrollTop - clientHeight < SCROLL_NEAR_BOTTOM_THRESHOLD;
      isNearBottom[1](near);
      const hasMore = messages.hasMoreOlder[roomId] ?? true;
      const loading = messages.loadingOlder[roomId] ?? false;
      if (
        hasMore &&
        !loading &&
        scrollTop < SCROLL_LOAD_OLDER_THRESHOLD &&
        props.messages.length > 0
      ) {
        onLoad(getScrollContainer);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Don't run initial isNearBottom check – keep default true so scroll-to-bottom works on first load
    onCleanup(() => el.removeEventListener('scroll', onScroll));
  });

  // Scroll to bottom when new messages arrive – only if user was near bottom (else they’re reading history)
  createEffect(() => {
    const roomId = props.roomId;
    const tick = roomId ? messages.scrollToBottomTick[roomId] ?? 0 : 0;
    const el = listRef[0]?.();
    const nearBottom = isNearBottom[0]();
    if (!el || !roomId || tick === 0) return;
    if (!nearBottom) return;
    const scrollToBottom = () => { el.scrollTop = el.scrollHeight; };
    scrollToBottom();
    const rafId = requestAnimationFrame(scrollToBottom);
    const timeoutId = setTimeout(scrollToBottom, SCROLL_TO_BOTTOM_DELAY_MS);
    onCleanup(() => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    });
  });

  // IntersectionObserver: load older when sentinel scrolls into view
  // Delay observe so scroll-to-bottom runs first; otherwise IO fires on mount when scrollTop is still 0
  createEffect(() => {
    const roomId = props.roomId;
    const sentinel = sentinelRef[0]?.();
    const listEl = listRef[0]?.();
    const onLoad = props.onLoadOlder;
    const hasMore = roomId ? (messages.hasMoreOlder[roomId] ?? true) : false;
    const loading = roomId ? (messages.loadingOlder[roomId] ?? false) : false;
    if (!roomId || !sentinel || !listEl || !onLoad || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        if (props.messages.length > 0) onLoad(getScrollContainer);
      },
      { root: listEl, rootMargin: '100px 0px 0px 0px', threshold: 0 }
    );
    const t = setTimeout(() => io.observe(sentinel), IO_OBSERVE_DELAY_MS);
    onCleanup(() => {
      clearTimeout(t);
      io.disconnect();
    });
  });

  function shouldShowHeader(msg: DecryptedMessage, prev: DecryptedMessage | undefined): boolean {
    if (!prev) return true;
    if (prev.sender_id !== msg.sender_id) return true;
    const prevTime = new Date(prev.created_at).getTime();
    const currTime = new Date(msg.created_at).getTime();
    if (currTime - prevTime > MESSAGE_GROUP_THRESHOLD_MS) return true;
    return false;
  }

  function shouldShowDateHeader(msg: DecryptedMessage, prev: DecryptedMessage | undefined): boolean {
    if (!prev) return true;
    const prevDate = new Date(prev.created_at).toDateString();
    const currDate = new Date(msg.created_at).toDateString();
    return prevDate !== currDate;
  }

  return (
    <div
      ref={(el) => listRef[1](el)}
      class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
    >
      <div class="flex flex-col p-4 gap-2 min-h-full justify-end">
        <Show when={props.messages.length === 0}>
          <p class="text-center text-muted-foreground text-sm py-8">No messages yet. Say hello!</p>
        </Show>
        <Show when={props.messages.length > 0 && (props.hasMoreOlder ?? true)}>
          <div
            ref={(el) => sentinelRef[1](el)}
            class="h-12 shrink-0 flex items-center justify-center gap-2"
            aria-hidden
          >
            <Show
              when={props.loadingOlder}
              fallback={
                <button
                  type="button"
                  onClick={() => {
                    if (props.messages.length > 0) props.onLoadOlder?.(getScrollContainer);
                  }}
                  class="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded border border-border hover:bg-accent/50 transition-colors"
                >
                  Load older messages
                </button>
              }
            >
              <span class="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            </Show>
          </div>
        </Show>
        <For each={props.messages}>
          {(msg, i) => {
            const prev = () => props.messages[i() - 1];
            const showHeader = () => shouldShowHeader(msg, prev());
            const needsDateHeader = () => shouldShowDateHeader(msg, prev());
            const sender = () =>
              getSenderDisplay(msg.sender_id, props.participants, currentUserId());

            return (
              <>
                <Show when={needsDateHeader()}>
                  <div class="flex items-center gap-3 py-3">
                    <div class="flex-1 h-px bg-border" />
                    <span class="text-xs text-muted-foreground shrink-0">
                      {formatDateHeader(new Date(msg.created_at))}
                    </span>
                    <div class="flex-1 h-px bg-border" />
                  </div>
                </Show>
                <div
                  data-msg-id={msg.id}
                  class={`flex gap-3 hover:bg-[hsl(var(--background)/0.3)] -mx-2 px-2 py-0.5 rounded group ${
                    showHeader() ? (prev() ? 'mt-3' : '') : '-mt-1'
                  }`}
                >
                <Show when={!compact()}>
                  <Show
                    when={showHeader()}
                    fallback={<div class="w-10 h-4 shrink-0" />}
                  >
                    <Avatar name={sender().name} avatar={sender().avatar} />
                  </Show>
                </Show>
                <div class="flex-1 min-w-0">
                  <Show when={showHeader()}>
                    <div class="flex items-baseline gap-2 flex-wrap mb-0.5">
                      <span class="text-sm font-semibold text-foreground shrink-0 truncate">{sender().name}</span>
                      <span class="text-[13px] text-muted-foreground shrink-0">
                        {formatMessageTimestamp(new Date(msg.created_at))}
                      </span>
                    </div>
                  </Show>
                  <p class="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                    {getMessageBodyText(msg)}
                  </p>
                  <Show when={msg.pending}>
                    <span class="text-[10px] text-muted-foreground/70">Sending...</span>
                  </Show>
                  <Show when={msg.notEncrypted && !msg.pending}>
                    <span class="text-[10px] text-amber-500/90">Not encrypted</span>
                  </Show>
                </div>
              </div>
              </>
            );
          }}
        </For>
      </div>
    </div>
  );
};
