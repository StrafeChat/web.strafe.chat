import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show, onCleanup } from 'solid-js';
import type { DecryptedMessage } from '../stores/messages';
import { messages, setMessages, editMessage as editMessageInStore } from '../stores/messages';
import type { RoomParticipant } from '../api/rooms';
import { auth } from '../stores/auth';
import { settings } from '../stores/settings';
import { messageIdGt } from '../stores/readState';
import { newHeaderDismissed } from '../stores/newHeaderDismissed';
import { formatMessageTimestamp, formatDateHeader } from '../lib/utils/datetime';
import { showContextMenu } from '../stores/contextMenu';
import { deleteMessage as deleteMessageApi } from '../api/messages';
import { Tooltip } from './ui/Tooltip';
import {
  getMessageBodyText,
  isEdited,
  getSenderDisplay,
  MessageAvatar,
  DeleteMessageModal,
  MessageListIntro,
  LoadOlderBlock,
} from './messageList';
import { isMessagePinned, pinMessage, unpinMessage } from '../stores/pinnedMessages';
import { scrollToMessage } from '../lib/utils/messages';

const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;
const SCROLL_NEAR_BOTTOM_THRESHOLD = 150;
const SCROLL_LOAD_OLDER_THRESHOLD = 100;
const SCROLL_TO_BOTTOM_DELAY_MS = 100;
const IO_OBSERVE_DELAY_MS = 0;

export interface MessageListProps {
  messages: DecryptedMessage[];
  roomId?: string;
  /** 1 = PM, 2 = group. Used to show intro header at top. */
  roomType?: number;
  /** Group/notes display name (e.g. room.name for groups, "Notes" for notes). */
  roomName?: string;
  participants?: RoomParticipant[];
  compact?: boolean;
  loadingOlder?: boolean;
  hasMoreOlder?: boolean;
  onLoadOlder?: (getScrollContainer: () => HTMLDivElement | undefined) => void;
  /** Last read message ID - NEW header shown above first unread (from others, id > this) */
  lastReadMessageId?: string | null;
  /** Max message ID when we entered - don't show NEW for messages that arrived while viewing (id > this) */
  maxMessageIdWhenEntered?: string | null;
  /** Called when user chooses to reply to a specific message. */
  onReply?: (message: DecryptedMessage) => void;
}

export const MessageList: Component<MessageListProps> = (props) => {
  const listRef = createSignal<HTMLDivElement>();
  const sentinelRef = createSignal<HTMLDivElement>();
  const isNearBottom = createSignal(true);
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editDraft, setEditDraft] = createSignal('');
  const [pendingDelete, setPendingDelete] = createSignal<{ roomId: string; msgId: string; message: DecryptedMessage } | null>(null);

  function doDelete(roomId: string, msgId: string) {
    deleteMessageApi(roomId, msgId)
      .then(() => {
        setMessages('byRoom', roomId, (prev: DecryptedMessage[] | undefined) =>
          (prev ?? []).filter((m: DecryptedMessage) => m.id !== msgId)
        );
      })
      .catch((err) => console.error('Delete message failed:', err));
    setPendingDelete(null);
  }

  const getScrollContainer = () => listRef[0]?.();
  const currentUserId = () => auth.user?.id;
  const compact = () => (props.compact !== undefined ? props.compact : settings.messageCompact);

  /** Index of first unread that existed when we entered and NEW header not dismissed. */
  const firstUnreadIndex = () => {
    if (props.roomId && newHeaderDismissed.byRoom[props.roomId]) return -1;
    const lastRead = props.lastReadMessageId ?? null;
    const maxWhenEntered = props.maxMessageIdWhenEntered ?? null;
    const uid = currentUserId();
    for (let i = 0; i < props.messages.length; i++) {
      const m = props.messages[i];
      if (m.sender_id === uid || !/^\d+$/.test(m.id)) continue;
      if (maxWhenEntered != null && messageIdGt(m.id, maxWhenEntered)) continue; // arrived while viewing
      if (lastRead == null || messageIdGt(m.id, lastRead)) return i;
    }
    return -1;
  };

  // Track scroll position for auto-scroll and load older
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
    onCleanup(() => el.removeEventListener('scroll', onScroll));
  });

  // Scroll to bottom when new messages arrive – only if user was near bottom (else they’re reading history)
  createEffect(() => {
    const roomId = props.roomId;
    const tick = roomId ? messages.scrollToBottomTick[roomId] ?? 0 : 0;
    const el = listRef[0]?.();
    const nearBottom = isNearBottom[0]();
    if (!el || !roomId || tick === 0) return;
    const scrollToBottom = () => { el.scrollTop = el.scrollHeight; };
    if (!nearBottom) return;
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
    // Replies always start a new visual block
    if (msg.reply_to_id) return true;
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

  /** True if msg is the first unread that existed when we entered (excludes messages that arrived while viewing). */
  function isFirstUnreadMessage(msg: DecryptedMessage, index: number): boolean {
    if (props.roomId && newHeaderDismissed.byRoom[props.roomId]) return false;
    if (msg.sender_id === currentUserId() || !/^\d+$/.test(msg.id)) return false;
    const lastRead = props.lastReadMessageId ?? null;
    const maxWhenEntered = props.maxMessageIdWhenEntered ?? null;
    if (maxWhenEntered != null && messageIdGt(msg.id, maxWhenEntered)) return false;
    const isUnread = lastRead == null || messageIdGt(msg.id, lastRead);
    if (!isUnread) return false;
    for (let j = 0; j < index; j++) {
      const m = props.messages[j];
      if (m.sender_id !== currentUserId() && /^\d+$/.test(m.id)) {
        if (maxWhenEntered != null && messageIdGt(m.id, maxWhenEntered)) continue;
        const prevUnread = lastRead == null || messageIdGt(m.id, lastRead);
        if (prevUnread) return false;
      }
    }
    return true;
  }

  /** For PM (type 1): the other participant. */
  const pmOther = () => {
    if (props.roomType !== 1 || !currentUserId() || !props.participants?.length) return undefined;
    return props.participants.find((p) => p.id !== currentUserId());
  };

  /** True if this is the current user's notes room (self-PM). */
  const isNotes = () =>
    props.roomType === 1 &&
    props.participants?.length === 1 &&
    currentUserId() &&
    props.participants[0]?.id === currentUserId();

  return (
    <>
    <div
      ref={(el) => listRef[1](el)}
      class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
    >
      <div class="flex flex-col p-4 gap-2 min-h-full justify-end">
        <MessageListIntro
          roomType={props.roomType}
          roomName={props.roomName}
          pmOther={pmOther()}
          isNotes={!!isNotes()}
        />
        <LoadOlderBlock
          hasMessages={props.messages.length > 0}
          hasMoreOlder={props.hasMoreOlder ?? true}
          loadingOlder={props.loadingOlder ?? false}
          sentinelRef={(el) => sentinelRef[1](el)}
          onLoadOlder={props.onLoadOlder ?? (() => {})}
          getScrollContainer={getScrollContainer}
        />
        <For each={props.messages}>
          {(msg, i) => {
            const prev = () => props.messages[i() - 1];
            const showHeader = () => shouldShowHeader(msg, prev());
            const needsDateHeader = () => shouldShowDateHeader(msg, prev());
            const sender = () =>
              getSenderDisplay(msg.sender_id, props.participants, currentUserId());

            const showUnreadHeader = () => isFirstUnreadMessage(msg, i());
            const showDateHeader = () => needsDateHeader();
            const showCombinedHeader = () => showUnreadHeader() && showDateHeader();

            return (
              <>
                <Show when={showCombinedHeader()}>
                  <div class="flex items-center gap-3 py-2">
                    <div class="flex-1 h-px bg-primary/60" />
                    <span class="text-xs font-semibold text-primary shrink-0 uppercase tracking-wide">
                      New messages · {formatDateHeader(new Date(msg.created_at))}
                    </span>
                    <div class="flex-1 h-px bg-primary/60" />
                  </div>
                </Show>
                <Show when={showUnreadHeader() && !showDateHeader()}>
                  <div class="flex items-center gap-3 py-2">
                    <div class="flex-1 h-px bg-primary/60" />
                    <span class="text-xs font-semibold text-primary shrink-0 uppercase tracking-wide">New messages</span>
                    <div class="flex-1 h-px bg-primary/60" />
                  </div>
                </Show>
                <Show when={showDateHeader() && !showUnreadHeader()}>
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
                  class={`flex gap-3 -mx-2 px-2 rounded group relative transition-colors md:hover:bg-muted/50 ${
                    compact() ? 'py-0.5' : 'py-0.5'
                  } ${
                    showHeader() ? (prev() ? 'mt-3' : '') : compact() ? '-mt-0.5' : '-mt-1'
                  }`}
                  onContextMenu={(e) => {
                    const roomId = props.roomId;
                    const bodyText = getMessageBodyText(msg);
                    const isOwn = msg.sender_id === currentUserId();
                    const pinned = isMessagePinned(props.roomId, msg.id);
                    showContextMenu(e, [
                      {
                        label: 'Copy Text',
                        icon: 'fa-copy',
                        onClick: () => navigator.clipboard.writeText(bodyText),
                      },
                      {
                        label: 'Copy Message ID',
                        icon: 'fa-hashtag',
                        onClick: () => navigator.clipboard.writeText(msg.id),
                      },
                      ...(props.onReply
                        ? [
                            {
                              label: 'Reply',
                              icon: 'fa-reply',
                              onClick: () => props.onReply?.(msg),
                            },
                          ]
                        : []),
                      ...(props.roomId
                        ? [
                            {
                              label: pinned ? 'Unpin message' : 'Pin message',
                              icon: 'fa-thumbtack',
                              onClick: () =>
                                pinned
                                  ? unpinMessage(props.roomId, msg.id)
                                  : pinMessage(props.roomId, msg.id),
                            },
                          ]
                        : []),
                      ...(isOwn && roomId
                        ? [
                            {
                              label: 'Edit Message',
                              icon: 'fa-pencil',
                              onClick: () => {
                                setEditDraft(getMessageBodyText(msg));
                                setEditingMessageId(msg.id);
                              },
                            },
                            {
                              label: 'Delete message',
                              icon: 'fa-trash',
                              danger: true,
                              onClick: (e?: MouseEvent) => {
                                if (e?.shiftKey) {
                                  doDelete(roomId, msg.id);
                                } else {
                                  setPendingDelete({ roomId, msgId: msg.id, message: msg });
                                }
                              },
                            },
                          ]
                        : []),
                    ]);
                  }}
                >
                <Show when={!compact()}>
                  <div class="relative w-10 flex justify-center">
                    <Show
                      when={showHeader()}
                      fallback={<div class="w-10 h-4 shrink-0" />}
                    >
                      <MessageAvatar name={sender().name} avatar={sender().avatar} />
                    </Show>
                    <Show when={msg.reply_to_id}>
                      <div class="absolute top-full mt-0.5 w-px h-4 bg-border/70" />
                    </Show>
                  </div>
                </Show>
                <div class="flex-1 min-w-0">
                  <Show when={editingMessageId() === msg.id}>
                    <div class="space-y-2">
                      <textarea
                        value={editDraft()}
                        onInput={(e) => setEditDraft(e.currentTarget.value)}
                        class="w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                        placeholder="Edit message..."
                        autofocus
                      />
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                          onClick={() => {
                            const roomId = props.roomId!;
                            const text = editDraft().trim();
                            if (text) {
                              editMessageInStore(roomId, msg.id, text).then(() => setEditingMessageId(null)).catch((err) => console.error('Edit failed:', err));
                            }
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          class="px-3 py-1.5 rounded-md text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
                          onClick={() => setEditingMessageId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </Show>
                  <Show when={editingMessageId() !== msg.id}>
                  <Show when={msg.reply_to_id}>
                    {(() => {
                      const replied =
                        props.messages.find((m) => m.id === msg.reply_to_id) ??
                        undefined;
                      if (!replied) {
                        return (
                          <button
                            type="button"
                            class="mb-0.5 max-w-full text-left flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground/90"
                            onClick={() => scrollToMessage(msg.reply_to_id!)}
                          >
                            <span class="truncate">
                              Replying to message{' '}
                              <span class="font-mono text-[10px]">
                                #{msg.reply_to_id}
                              </span>
                            </span>
                          </button>
                        );
                      }
                      const repliedSender = getSenderDisplay(
                        replied.sender_id,
                        props.participants,
                        currentUserId()
                      );
                      const repliedText = getMessageBodyText(replied);
                      const preview =
                        repliedText.length > 80
                          ? `${repliedText.slice(0, 77)}…`
                          : repliedText;
                      const initial =
                        repliedSender.name?.[0]?.toUpperCase() ?? '?';
                      return (
                        <button
                          type="button"
                          class="mb-0.5 max-w-full text-left flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground/90"
                          onClick={() => scrollToMessage(msg.reply_to_id!)}
                        >
                          <div class="shrink-0">
                            <div class="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
                              {initial}
                            </div>
                          </div>
                          <div class="flex-1 min-w-0 flex items-center gap-1">
                            <span class="text-[11px] text-foreground font-medium truncate">
                              {repliedSender.name}
                            </span>
                            <span class="text-[11px] text-muted-foreground truncate">
                              {preview}
                            </span>
                          </div>
                        </button>
                      );
                    })()}
                  </Show>
                  <Show when={compact()}>
                    <div class="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                      <span class="text-sm font-semibold text-foreground shrink-0">{sender().name}</span>
                      <span class="text-[11px] text-muted-foreground shrink-0">
                        {formatMessageTimestamp(new Date(msg.created_at))}
                      </span>
                      <span class="text-muted-foreground/70 shrink-0">·</span>
                      <span
                        class={`text-sm break-words whitespace-pre-wrap flex-1 min-w-0 transition-colors duration-200 ${
                          msg.pending ? 'text-muted-foreground/60' : 'text-muted-foreground'
                        }`}
                      >
                        {getMessageBodyText(msg)}
                        <Show when={isEdited(msg)}>
                          <Tooltip label={`Edited ${formatMessageTimestamp(new Date(msg.updated_at!))}`} inline side="top">
                            <span class="text-[10px] text-muted-foreground/80 ml-1 cursor-default">(edited)</span>
                          </Tooltip>
                        </Show>
                      </span>
                      <Show when={msg.notEncrypted && !msg.pending}>
                        <span class="text-[10px] text-amber-500/90 shrink-0">Not encrypted</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={!compact()}>
                    <Show when={showHeader()}>
                      <div class="flex items-baseline gap-2 flex-wrap mb-0.5">
                        <span class="text-sm font-semibold text-foreground shrink-0 truncate">{sender().name}</span>
                        <span class="text-[13px] text-muted-foreground shrink-0">
                          {formatMessageTimestamp(new Date(msg.created_at))}
                        </span>
                      </div>
                    </Show>
                    <p
                      class={`text-sm break-words whitespace-pre-wrap transition-colors duration-200 ${
                        msg.pending ? 'text-muted-foreground/60' : 'text-muted-foreground'
                      }`}
                    >
                      {getMessageBodyText(msg)}
                      <Show when={isEdited(msg)}>
                        <Tooltip label={`Edited ${formatMessageTimestamp(new Date(msg.updated_at!))}`} inline side="top">
                          <span class="text-[9px] text-muted-foreground/80 ml-1 cursor-default">(edited)</span>
                        </Tooltip>
                      </Show>
                    </p>
                    <Show when={msg.notEncrypted && !msg.pending}>
                      <span class="text-[10px] text-amber-500/90">Not encrypted</span>
                    </Show>
                  </Show>
                  </Show>
                </div>
                <div class="hidden md:flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-0 -translate-y-1/2 bg-[hsl(0_0%_10%)] rounded-md border border-border py-0.5 px-1 shadow">
                  <Show when={props.onReply}>
                    <Tooltip label="Reply" inline side="top">
                      <button
                        type="button"
                        class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          props.onReply?.(msg);
                        }}
                      >
                        <i class="fa-solid fa-reply text-xs" />
                      </button>
                    </Tooltip>
                  </Show>
                  <Show when={props.roomId}>
                    <Tooltip label={isMessagePinned(props.roomId, msg.id) ? 'Unpin message' : 'Pin message'} inline side="top">
                      <button
                        type="button"
                        class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!props.roomId) return;
                          if (isMessagePinned(props.roomId, msg.id)) {
                            unpinMessage(props.roomId, msg.id);
                          } else {
                            pinMessage(props.roomId, msg.id);
                          }
                        }}
                      >
                        <i class="fa-solid fa-thumbtack text-xs" />
                      </button>
                    </Tooltip>
                  </Show>
                  <Tooltip label="Copy Text" inline side="top">
                    <button
                      type="button"
                      class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(getMessageBodyText(msg));
                      }}
                    >
                      <i class="fa-solid fa-copy text-xs" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Copy Message ID" inline side="top">
                    <button
                      type="button"
                      class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(msg.id);
                      }}
                    >
                      <i class="fa-solid fa-hashtag text-xs" />
                    </button>
                  </Tooltip>
                  <Show when={msg.sender_id === currentUserId() && props.roomId}>
                    <Tooltip label="Edit Message" inline side="top">
                      <button
                        type="button"
                        class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditDraft(getMessageBodyText(msg));
                          setEditingMessageId(msg.id);
                        }}
                      >
                        <i class="fa-solid fa-pencil text-xs" />
                      </button>
                    </Tooltip>
                    <Tooltip label="Delete Message" inline side="top">
                      <button
                        type="button"
                        class="size-8 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          const roomId = props.roomId!;
                          if (e.shiftKey) {
                            doDelete(roomId, msg.id);
                          } else {
                            setPendingDelete({ roomId, msgId: msg.id, message: msg });
                          }
                        }}
                      >
                        <i class="fa-solid fa-trash text-xs" />
                      </button>
                    </Tooltip>
                  </Show>
                </div>
              </div>
              </>
            );
          }}
        </For>
      </div>
    </div>

    <DeleteMessageModal
      pending={pendingDelete()}
      participants={props.participants}
      currentUserId={currentUserId()}
      onConfirm={doDelete}
      onCancel={() => setPendingDelete(null)}
    />
    </>
  );
};
