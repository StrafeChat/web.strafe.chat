import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show, onCleanup, onMount } from 'solid-js';
import type { DecryptedMessage } from '../stores/messages';
import { messages, setMessages, editMessage as editMessageInStore, toggleReaction } from '../stores/messages';
import type { RoomParticipant } from '../api/rooms';
import type { SpaceRole } from '../api/spaces';
import { auth } from '../stores/auth';
import { settings } from '../stores/settings';
import { messageIdGt } from '../stores/readState';
import { newHeaderDismissed } from '../stores/newHeaderDismissed';
import { formatMessageTimestamp, formatDateHeader, formatTimeOfDay } from '../lib/utils/datetime';
import { t } from '../i18n';
import { showContextMenu } from '../stores/contextMenu';
import { buildUserMenuItems } from '../lib/userContextMenu';
import { isBlocked } from '../stores/relationships';
import { openReportDialog } from './ReportDialog';
import { deleteMessage as deleteMessageApi } from '../api/messages';
import { Tooltip } from './ui/Tooltip';
import {
  getMessageBodyText,
  isEdited,
  getSenderDisplay,
  isSystemMessage,
  formatSystemMessageText,
  MessageAvatar,
  MessageBody,
  DeleteMessageModal,
  MessageListIntro,
  LoadOlderBlock,
  ReplyReference,
  MessageReactions,
} from './messageList';
import { appFloatToolbar } from '../theme/appChrome';
import { MessageAttachments } from './messageList/MessageAttachments';
import { EmojiPicker, type EmojiPick } from './emoji/EmojiPicker';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { isMessagePinned, pinMessage, unpinMessage } from '../stores/pinnedMessages';
import { openUserProfilePopover } from '../stores/userProfilePopover';
import { popoverSubjectFromSender } from '../lib/userProfilePopoverHelpers';
import { viewerRoleCeiling } from '../lib/spacePermissions';

const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;
/** Treat as “at bottom” if within this many px. */
const BOTTOM_THRESHOLD_PX = 24;
const SCROLL_LOAD_OLDER_THRESHOLD = 100;
const USER_SCROLL_IDLE_MS = 120;
const SCROLL_TO_BOTTOM_DELAY_MS = 100;
const IO_OBSERVE_DELAY_MS = 0;
const ACK_VISIBILITY_DEBOUNCE_MS = 450;

/**
 * Room ids whose initial "land on first unread" scroll has already happened this session.
 * Deliberately not `scrollToBottomTick === 1`: that tick also bumps for messages arriving
 * over the socket while the room isn't even open (StargateProvider subscribes to every room
 * up front - see stores/messages.ts addMessageFromEvent), so a room that received several
 * background messages before you ever opened it would already be past tick 1 on first
 * view, making the old check skip straight to the bottom instead of landing on the unread
 * boundary. This set tracks "have we shown this room's content at all yet" directly,
 * independent of how many background ticks happened first.
 */
const roomsWithInitialScrollDone = new Set<string>();

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
  /** When false, Reply is omitted from the context menu (e.g. no send permission). Default true. */
  canReply?: boolean;
  /** When false, Pin message is omitted. Default true (DMs / non-space rooms). */
  canManageMessages?: boolean;
  /** When false, adding a new reaction is disabled (existing reactions still show, and the
   * viewer can still remove their own). Default true (DMs / non-space rooms). */
  canReact?: boolean;
  /** When false, room messages are plaintext (no E2EE). Show one banner and hide per-message "Not encrypted". */
  e2eeEnabled?: boolean;
  /** Reports near-bottom state for parent read/ack logic. */
  onNearBottomChange?: (nearBottom: boolean) => void;
  /** Exposes scroll container element to parent. */
  onScrollContainer?: (el: HTMLDivElement | undefined) => void;
  /** Bottom-most visible message id (debounced), for viewport ACK. */
  onBottomVisibleMessageChange?: (messageId: string | null) => void;
  /** Space text channels: show role chips and join date in author profile popover. */
  spaceRoles?: SpaceRole[];
  /** When set with spaceRoles, profile popover can include space role editing if allowed. */
  spaceId?: string;
  spaceOwnerId?: string;
  canManageMemberRoles?: boolean;
  onSpaceMemberRolesUpdated?: () => void;
  /** Open DM with user (profile popover). */
  onMessageUser?: (userId: string) => void;
}

export const MessageList: Component<MessageListProps> = (props) => {
  const listRef = createSignal<HTMLDivElement>();
  const sentinelRef = createSignal<HTMLDivElement>();
  const isNearBottom = createSignal(true);
  /** True shortly after the user moves the scroll viewport (don’t auto-scroll over them). */
  const [isUserScrolling, setIsUserScrolling] = createSignal(false);
  /** Set while MessageList scrolls itself so `onScroll` does not flip user-scrolling state. */
  const programmaticScrollRef = { current: false };
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editDraft, setEditDraft] = createSignal('');
  const [pendingDelete, setPendingDelete] = createSignal<{ roomId: string; msgId: string; message: DecryptedMessage } | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = createSignal<string | null>(null);

  function emojiKeyFromPick(pick: EmojiPick): string {
    return pick.custom ? `custom:${pick.custom.id}` : pick.unicode!;
  }

  function pickReaction(msg: DecryptedMessage, pick: EmojiPick) {
    const roomId = props.roomId;
    if (!roomId) return;
    const emoji = emojiKeyFromPick(pick);
    const mine = msg.reactions?.find((r) => r.emoji === emoji)?.me ?? false;
    toggleReaction(roomId, msg.id, emoji, mine).catch((err) => console.error('Toggle reaction failed:', err));
    setReactionPickerFor(null);
  }

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
  const canReact = () => props.canReact !== false;

  let publishTimer: ReturnType<typeof setTimeout> | null = null;
  /** Report the bottom-most message with any part on screen - the viewport-ack cursor. */
  function publishBottomVisible() {
    const el = listRef[0]?.();
    if (!el) return;
    const containerRect = el.getBoundingClientRect();
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-msg-id]'));
    let bestId: string | null = null;
    let bestBottom = -Infinity;
    for (const node of nodes) {
      const id = node.getAttribute('data-msg-id');
      if (!id || !/^\d+$/.test(id)) continue;
      const rect = node.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
      if (visibleBottom <= visibleTop) continue;
      if (visibleBottom > bestBottom) {
        bestBottom = visibleBottom;
        bestId = id;
      }
    }
    props.onBottomVisibleMessageChange?.(bestId);
  }
  function queuePublishBottomVisible() {
    if (publishTimer) clearTimeout(publishTimer);
    publishTimer = setTimeout(publishBottomVisible, ACK_VISIBILITY_DEBOUNCE_MS);
  }
  onCleanup(() => {
    if (publishTimer) clearTimeout(publishTimer);
  });

  // Re-measure whenever the list content changes or the tab comes back into view. Scroll
  // events alone aren't enough: a short list that never scrolls, or a message arriving
  // while you're already sitting at the bottom, never fires one - so the ack cursor stayed
  // on the previous message while you looked straight at the new one.
  createEffect(() => {
    void props.messages.length;
    void props.roomId;
    queuePublishBottomVisible();
  });
  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') queuePublishBottomVisible();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    });
  });

  function openAuthorProfile(msg: DecryptedMessage, anchor: HTMLElement) {
    openProfileForUser(msg.sender_id, anchor);
  }

  /** Right-clicking a message author gives the same user menu as a member row. */
  function openAuthorMenu(msg: DecryptedMessage, e: MouseEvent) {
    const s = getSenderDisplay(msg.sender_id, props.participants, currentUserId());
    const items = buildUserMenuItems({
      userId: msg.sender_id,
      username: s.username || '',
      displayName: s.name,
      discriminator: s.discriminator,
      currentUserId: currentUserId(),
      onMessage: props.onMessageUser,
      spaceId: props.spaceId,
      roomId: props.roomId,
    });
    if (items.length) showContextMenu(e, items);
  }

  // Messages from blocked users are hidden. Filtered only for rendering (and the grouping
  // that reads the previous rendered message); unread/scroll bookkeeping still sees the raw
  // list, which is fine - a blocked message is rare and simply doesn't appear.
  const visibleMessages = createMemo(() => props.messages.filter((m) => !isBlocked(m.sender_id)));

  /** Profile card for any user id in this room - message authors and @mention pills alike. */
  function openProfileForUser(userId: string, anchor: HTMLElement) {
    const uid = currentUserId();
    const s = getSenderDisplay(userId, props.participants, uid);
    const p = props.participants?.find((x) => x.id === userId);
    const spaceRoleContext =
      props.spaceId &&
      props.spaceRoles != null &&
      props.spaceRoles.length > 0
        ? {
            spaceId: props.spaceId,
            spaceOwnerId: props.spaceOwnerId ?? '',
            subjectRoleIds: [...((p as { roles?: string[] } | undefined)?.roles ?? [])],
            spaceRoles: props.spaceRoles,
            canManageMemberRoles: props.canManageMemberRoles === true,
            viewerHighestPosition: viewerRoleCeiling(props.spaceOwnerId, uid, props.spaceRoles, props.participants),
            onMemberRolesUpdated: props.onSpaceMemberRolesUpdated,
          }
        : null;

    openUserProfilePopover({
      anchor,
      subject: popoverSubjectFromSender(s, { participant: p, spaceRoles: props.spaceRoles }),
      currentUserId: uid,
      onMessageUser: props.onMessageUser,
      spaceRoleContext,
    });
  }

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
    let userScrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (!programmaticScrollRef.current) {
        setIsUserScrolling(true);
        if (userScrollIdleTimer) clearTimeout(userScrollIdleTimer);
        userScrollIdleTimer = setTimeout(() => {
          userScrollIdleTimer = null;
          setIsUserScrolling(false);
        }, USER_SCROLL_IDLE_MS);
      }

      const { scrollTop, clientHeight, scrollHeight } = el;
      const near =
        scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD_PX;
      isNearBottom[1](near);
      props.onNearBottomChange?.(near);
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
      queuePublishBottomVisible();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    props.onScrollContainer?.(el);
    queuePublishBottomVisible();
    onCleanup(() => el.removeEventListener('scroll', onScroll));
    onCleanup(() => props.onScrollContainer?.(undefined));
    onCleanup(() => {
      if (userScrollIdleTimer) clearTimeout(userScrollIdleTimer);
    });
  });

  // Scroll to bottom when new messages arrive – only if at bottom and user isn’t actively scrolling.
  // The FIRST time this room's content is actually shown this session, land on the
  // first-unread divider instead of always dropping straight to the bottom past it. Every
  // later run (new message arrives, own message sent, etc.) keeps plain scroll-to-bottom.
  // Deliberately keyed off roomsWithInitialScrollDone, not scrollToBottomTick === 1: the tick
  // also bumps for messages received while this room isn't even open, so a room that racked
  // up a backlog in the background would already be past tick 1 by the time it's first
  // opened, and the old check would skip straight to the bottom past all of it.
  createEffect(() => {
    const roomId = props.roomId;
    const tick = roomId ? messages.scrollToBottomTick[roomId] ?? 0 : 0;
    const el = listRef[0]?.();
    const nearBottom = isNearBottom[0]();
    const userSc = isUserScrolling();
    if (!el || !roomId || tick === 0) return;
    if (!nearBottom || userSc) return;
    const isInitialView = !roomsWithInitialScrollDone.has(roomId);
    if (isInitialView) roomsWithInitialScrollDone.add(roomId);
    const unreadIdx = isInitialView ? firstUnreadIndex() : -1;
    const scrollToTarget = () => {
      const target = unreadIdx !== -1 ? props.messages[unreadIdx] : undefined;
      const node = target ? el.querySelector<HTMLElement>(`[data-msg-id="${target.id}"]`) : null;
      if (node) {
        const relativeTop = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        el.scrollTo({ top: Math.max(0, relativeTop - 96), behavior: 'auto' });
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      }
    };
    programmaticScrollRef.current = true;
    scrollToTarget();
    const rafId = requestAnimationFrame(scrollToTarget);
    const timeoutId = setTimeout(() => {
      scrollToTarget();
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }, SCROLL_TO_BOTTOM_DELAY_MS);
    onCleanup(() => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      programmaticScrollRef.current = false;
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

  /** Body is a decrypt-state placeholder ("waiting for key", legacy scheme, failure), not
   * real content - rendered muted/italic so it reads as a status line, not a message. */
  const isPlaceholderBody = (m: DecryptedMessage) => !!(m.decryptPending || m.decryptError || m.legacyUndecryptable);

  /** Indices for E2EE/plaintext section headers (single pass). */
  const e2eeHeaderIndices = createMemo(() => {
    const list = props.messages;
    let firstPlaintext = -1;
    let firstE2EEAfterPlaintext = -1;
    let seenPlaintext = false;
    let seenEncrypted = false;
    for (let i = 0; i < list.length; i++) {
      const m = list[i]!;
      if (m.id.startsWith('temp-') || m.system_type) continue;
      if (m.notEncrypted === true) {
        // "No longer encrypted" only makes sense after encrypted history - a room that
        // was never encrypted shouldn't announce a change on its very first message.
        if (firstPlaintext < 0 && seenEncrypted) firstPlaintext = i;
        seenPlaintext = true;
        continue;
      }
      seenEncrypted = true;
      if (seenPlaintext && firstE2EEAfterPlaintext < 0) firstE2EEAfterPlaintext = i;
    }
    return { firstPlaintext, firstE2EEAfterPlaintext };
  });

  const firstPlaintextMessageIndex = () => e2eeHeaderIndices().firstPlaintext;
  const firstE2EEMessageIndex = () => e2eeHeaderIndices().firstE2EEAfterPlaintext;

  function scrollToPresent() {
    const el = listRef[0]?.();
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  return (
    <>
    <div class="relative flex-1 min-h-0">
    <div
      ref={(el) => listRef[1](el)}
      class="absolute inset-0 overflow-y-auto overflow-x-hidden"
    >
      {/* Bottom padding tracks the floating composer (see RoomComposerDock) so the
          newest message clears it; 0 when the page doesn't dock a composer at all. */}
      <div class="flex flex-col p-4 gap-2 min-h-full justify-end pb-[calc(var(--composer-height,0px)+0.75rem)]">
        <MessageListIntro
          roomType={props.roomType}
          roomName={props.roomName}
          pmOther={pmOther()}
          isNotes={!!isNotes()}
          e2eeEnabled={props.e2eeEnabled}
        />
        <LoadOlderBlock
          hasMessages={props.messages.length > 0}
          hasMoreOlder={props.hasMoreOlder ?? true}
          loadingOlder={props.loadingOlder ?? false}
          sentinelRef={(el) => sentinelRef[1](el)}
          onLoadOlder={props.onLoadOlder ?? (() => {})}
          getScrollContainer={getScrollContainer}
        />
        <For each={visibleMessages()}>
          {(msg, i) => {
            const prev = () => visibleMessages()[i() - 1];
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
                      {t('messages.newMessages')} · {formatDateHeader(new Date(msg.created_at))}
                    </span>
                    <div class="flex-1 h-px bg-primary/60" />
                  </div>
                </Show>
                <Show when={showUnreadHeader() && !showDateHeader()}>
                  <div class="flex items-center gap-3 py-2">
                    <div class="flex-1 h-px bg-primary/60" />
                    <span class="text-xs font-semibold text-primary shrink-0 uppercase tracking-wide">{t('messages.newMessages')}</span>
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
                <Show when={firstPlaintextMessageIndex() === i()}>
                  <div class="flex items-center gap-3 py-3">
                    <div class="flex-1 h-px bg-border" />
                    <span class="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                      <i class="fa-solid fa-lock-open text-[10px]" />
                      {t('messages.noLongerEncrypted')}
                    </span>
                    <div class="flex-1 h-px bg-border" />
                  </div>
                </Show>
                <Show when={firstE2EEMessageIndex() === i()}>
                  <div class="flex items-center gap-3 py-3">
                    <div class="flex-1 h-px bg-border" />
                    <span class="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
                      <i class="fa-solid fa-lock text-[10px]" />
                      {t('messages.nowEncrypted')}
                    </span>
                    <div class="flex-1 h-px bg-border" />
                  </div>
                </Show>
                <Show
                  when={isSystemMessage(msg)}
                  fallback={(
                <div
                  data-msg-id={msg.id}
                  class={`flex gap-3 -mx-2 px-2 rounded-md group relative transition-colors md:hover:bg-muted/40 ${
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
                      ...(props.roomId && canReact()
                        ? [
                            {
                              label: t('messages.actions.addReaction'),
                              icon: 'fa-face-smile',
                              onClick: () => setReactionPickerFor(msg.id),
                            },
                          ]
                        : []),
                      {
                        label: t('messages.actions.copyText'),
                        icon: 'fa-copy',
                        onClick: () => navigator.clipboard.writeText(bodyText),
                      },
                      {
                        label: t('messages.actions.copyId'),
                        icon: 'fa-hashtag',
                        onClick: () => navigator.clipboard.writeText(msg.id),
                      },
                      ...(props.onReply && props.canReply !== false
                        ? [
                            {
                              label: t('messages.actions.reply'),
                              icon: 'fa-reply',
                              onClick: () => props.onReply?.(msg),
                            },
                          ]
                        : []),
                      ...(props.roomId && props.canManageMessages !== false
                        ? [
                            {
                              label: pinned ? t('messages.actions.unpin') : t('messages.actions.pin'),
                              icon: 'fa-thumbtack',
                              onClick: () =>
                                pinned
                                  ? unpinMessage(props.roomId, msg.id)
                                  : pinMessage(props.roomId, msg.id),
                            },
                          ]
                        : []),
                      ...(!isOwn && roomId
                        ? [
                            {
                              label: t('messages.actions.report'),
                              icon: 'fa-flag',
                              danger: true,
                              onClick: () => {
                                const s = getSenderDisplay(msg.sender_id, props.participants, currentUserId());
                                openReportDialog({
                                  targetType: 'user',
                                  targetId: msg.sender_id,
                                  targetName: s.name,
                                  spaceId: props.spaceId,
                                  roomId,
                                  messageId: msg.id,
                                  messageText: bodyText,
                                });
                              },
                            },
                          ]
                        : []),
                      ...(isOwn && roomId
                        ? [
                            {
                              label: t('messages.actions.edit'),
                              icon: 'fa-pencil',
                              onClick: () => {
                                setEditDraft(getMessageBodyText(msg));
                                setEditingMessageId(msg.id);
                              },
                            },
                            {
                              label: t('messages.actions.delete'),
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
                  <div class="relative flex w-10 shrink-0 flex-col items-center">
                    {/* Reply spine: from the middle of the reply line, down into the avatar. */}
                    <Show when={msg.reply_to_id}>
                      <div
                        class="pointer-events-none absolute left-1/2 top-[10px] h-[14px] w-[calc(50%+12px)] rounded-tl-lg border-l-2 border-t-2 border-border/70"
                        aria-hidden="true"
                      />
                    </Show>
                    <Show
                      when={showHeader()}
                      fallback={
                        <span class="w-10 select-none text-center text-[10px] leading-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          {formatTimeOfDay(new Date(msg.created_at))}
                        </span>
                      }
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        class={`cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          msg.reply_to_id ? 'mt-6' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openAuthorProfile(msg, e.currentTarget);
                        }}
                        onContextMenu={(e) => openAuthorMenu(msg, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openAuthorProfile(msg, e.currentTarget);
                          }
                        }}
                      >
                        <MessageAvatar name={sender().name} avatar={sender().avatar} />
                      </div>
                    </Show>
                  </div>
                </Show>
                <div class="flex-1 min-w-0">
                  <Show when={editingMessageId() === msg.id}>
                    <div class="space-y-2 py-1">
                      <Textarea
                        value={editDraft()}
                        onInput={(e) => setEditDraft(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingMessageId(null);
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const roomId = props.roomId!;
                            const text = editDraft().trim();
                            if (text) {
                              editMessageInStore(roomId, msg.id, text).then(() => setEditingMessageId(null)).catch((err) => console.error('Edit failed:', err));
                            }
                          }
                        }}
                        class="min-h-[72px]"
                        placeholder={t('messages.editPlaceholder')}
                        autofocus
                      />
                      <div class="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            const roomId = props.roomId!;
                            const text = editDraft().trim();
                            if (text) {
                              editMessageInStore(roomId, msg.id, text).then(() => setEditingMessageId(null)).catch((err) => console.error('Edit failed:', err));
                            }
                          }}
                        >
                          {t('common.save')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingMessageId(null)}>
                          {t('common.cancel')}
                        </Button>
                        <span class="text-[11px] text-muted-foreground">{t('messages.editHint')}</span>
                      </div>
                    </div>
                  </Show>
                  <Show when={editingMessageId() !== msg.id}>
                  <Show when={msg.reply_to_id}>
                    {(replyToId) => (
                      <ReplyReference
                        replyToId={replyToId()}
                        messages={props.messages}
                        participants={props.participants}
                        currentUserId={currentUserId()}
                        compact={compact()}
                      />
                    )}
                  </Show>
                  <Show when={compact()}>
                    <div class="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                      <span
                        role="button"
                        tabIndex={0}
                        class="text-sm font-semibold text-foreground shrink-0 cursor-pointer rounded px-0.5 -mx-0.5 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAuthorProfile(msg, e.currentTarget);
                        }}
                        onContextMenu={(e) => openAuthorMenu(msg, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openAuthorProfile(msg, e.currentTarget);
                          }
                        }}
                      >
                        {sender().name}
                      </span>
                      <span class="text-[11px] text-muted-foreground shrink-0">
                        {formatMessageTimestamp(new Date(msg.created_at))}
                      </span>
                      <span class="text-muted-foreground/70 shrink-0">·</span>
                      <span
                        class={`text-sm break-words flex-1 min-w-0 transition-colors duration-200 ${
                          msg.pending ? 'text-muted-foreground/70' : 'text-foreground/90'
                        } ${isPlaceholderBody(msg) ? 'italic text-muted-foreground' : ''}`}
                      >
                        <MessageBody
                          text={getMessageBodyText(msg)}
                          participants={props.participants}
                          spaceRoles={props.spaceRoles}
                          onMentionClick={openProfileForUser}
                        />
                        <Show when={isEdited(msg)}>
                          <Tooltip label={t('messages.editedAt', { time: formatMessageTimestamp(new Date(msg.updated_at!)) })} inline side="top">
                            <span class="text-[10px] text-muted-foreground/80 ms-1 cursor-default">{t('messages.edited')}</span>
                          </Tooltip>
                        </Show>
                      </span>
                      {/* <Show when={msg.notEncrypted && !msg.pending && props.e2eeEnabled !== false}>
                        <span class="text-[10px] text-amber-500/90 shrink-0">Not encrypted</span>
                      </Show> */}
                    </div>
                    <Show when={msg.attachments?.length}>
                      <MessageAttachments attachments={msg.attachments!} />
                    </Show>
                    <Show when={msg.reactions?.length}>
                      <MessageReactions
                        roomId={props.roomId!}
                        messageId={msg.id}
                        reactions={msg.reactions!}
                        canReact={canReact()}
                        onToggle={(emoji, mine) => toggleReaction(props.roomId!, msg.id, emoji, mine).catch((err) => console.error('Toggle reaction failed:', err))}
                      />
                    </Show>
                  </Show>
                  <Show when={!compact()}>
                    <Show when={showHeader()}>
                      <div class="flex items-baseline gap-2 flex-wrap mb-0.5">
                        <span
                          role="button"
                          tabIndex={0}
                          class="text-sm font-semibold text-foreground shrink-0 truncate cursor-pointer rounded px-0.5 -mx-0.5 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAuthorProfile(msg, e.currentTarget);
                          }}
                          onContextMenu={(e) => openAuthorMenu(msg, e)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              openAuthorProfile(msg, e.currentTarget);
                            }
                          }}
                        >
                          {sender().name}
                        </span>
                        <span class="text-[13px] text-muted-foreground shrink-0">
                          {formatMessageTimestamp(new Date(msg.created_at))}
                        </span>
                      </div>
                    </Show>
                    <div
                      class={`text-sm leading-relaxed break-words transition-colors duration-200 ${
                        msg.pending ? 'text-muted-foreground/70' : 'text-foreground/90'
                      } ${isPlaceholderBody(msg) ? 'italic text-muted-foreground' : ''}`}
                    >
                      <MessageBody
                        text={getMessageBodyText(msg)}
                        participants={props.participants}
                        spaceRoles={props.spaceRoles}
                        onMentionClick={openProfileForUser}
                      />
                      <Show when={isEdited(msg)}>
                        <Tooltip label={t('messages.editedAt', { time: formatMessageTimestamp(new Date(msg.updated_at!)) })} inline side="top">
                          <span class="text-[9px] text-muted-foreground/80 ms-1 cursor-default">{t('messages.edited')}</span>
                        </Tooltip>
                      </Show>
                      {/* <Show when={msg.notEncrypted && !msg.pending && props.e2eeEnabled !== false}>
                        <span class="text-[10px] text-amber-500/90">Not encrypted</span>
                      </Show> */}
                    </div>
                    <Show when={msg.attachments?.length}>
                      <MessageAttachments attachments={msg.attachments!} />
                    </Show>
                    <Show when={msg.reactions?.length}>
                      <MessageReactions
                        roomId={props.roomId!}
                        messageId={msg.id}
                        reactions={msg.reactions!}
                        canReact={canReact()}
                        onToggle={(emoji, mine) => toggleReaction(props.roomId!, msg.id, emoji, mine).catch((err) => console.error('Toggle reaction failed:', err))}
                      />
                    </Show>
                  </Show>
                  </Show>
                </div>
                <div class={`absolute end-2 top-0 hidden shrink-0 -translate-y-1/2 items-center gap-0.5 p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex ${appFloatToolbar}`}>
                  <Show when={props.roomId && canReact()}>
                    <Tooltip label={t('messages.actions.addReaction')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-face-smile"
                        label={t('messages.actions.addReaction')}
                        title=""
                        active={reactionPickerFor() === msg.id}
                        onClick={(e) => {
                          e.preventDefault();
                          setReactionPickerFor((v) => (v === msg.id ? null : msg.id));
                        }}
                      />
                    </Tooltip>
                  </Show>
                  <Show when={props.onReply && props.canReply !== false}>
                    <Tooltip label={t('messages.actions.reply')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-reply"
                        label={t('messages.actions.reply')}
                        title=""
                        onClick={(e) => {
                          e.preventDefault();
                          props.onReply?.(msg);
                        }}
                      />
                    </Tooltip>
                  </Show>
                  <Show when={props.roomId && props.canManageMessages !== false}>
                    <Tooltip label={isMessagePinned(props.roomId, msg.id) ? t('messages.actions.unpin') : t('messages.actions.pin')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-thumbtack"
                        label={isMessagePinned(props.roomId, msg.id) ? t('messages.actions.unpin') : t('messages.actions.pin')}
                        title=""
                        active={isMessagePinned(props.roomId, msg.id)}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!props.roomId) return;
                          if (isMessagePinned(props.roomId, msg.id)) {
                            unpinMessage(props.roomId, msg.id);
                          } else {
                            pinMessage(props.roomId, msg.id);
                          }
                        }}
                      />
                    </Tooltip>
                  </Show>
                  <Tooltip label={t('messages.actions.copyText')} inline side="top">
                    <IconButton
                      size="sm"
                      icon="fa-solid fa-copy"
                      label={t('messages.actions.copyText')}
                      title=""
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(getMessageBodyText(msg));
                      }}
                    />
                  </Tooltip>
                  <Tooltip label={t('messages.actions.copyId')} inline side="top">
                    <IconButton
                      size="sm"
                      icon="fa-solid fa-hashtag"
                      label={t('messages.actions.copyId')}
                      title=""
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(msg.id);
                      }}
                    />
                  </Tooltip>
                  <Show when={msg.sender_id === currentUserId() && props.roomId}>
                    <Tooltip label={t('messages.actions.edit')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-pencil"
                        label={t('messages.actions.edit')}
                        title=""
                        onClick={(e) => {
                          e.preventDefault();
                          setEditDraft(getMessageBodyText(msg));
                          setEditingMessageId(msg.id);
                        }}
                      />
                    </Tooltip>
                    <Tooltip label={t('messages.actions.delete')} inline side="top">
                      <IconButton
                        size="sm"
                        tone="danger"
                        icon="fa-solid fa-trash"
                        label={t('messages.actions.delete')}
                        title=""
                        onClick={(e) => {
                          e.preventDefault();
                          const roomId = props.roomId!;
                          if (e.shiftKey) {
                            doDelete(roomId, msg.id);
                          } else {
                            setPendingDelete({ roomId, msgId: msg.id, message: msg });
                          }
                        }}
                      />
                    </Tooltip>
                  </Show>
                </div>
                <Show when={reactionPickerFor() === msg.id}>
                  <div class="absolute end-2 top-8 z-30">
                    <EmojiPicker onClose={() => setReactionPickerFor(null)} onPick={(pick) => pickReaction(msg, pick)} />
                  </div>
                </Show>
              </div>
                )}
              >
                <div class="flex justify-center py-2" data-msg-id={msg.id}>
                  <span class="text-xs text-muted-foreground">
                    {formatSystemMessageText(
                      msg as DecryptedMessage & { system_type: string; system_payload: string },
                      props.participants,
                      currentUserId()
                    )}
                  </span>
                </div>
              </Show>
              </>
            );
          }}
        </For>
      </div>
    </div>
    <Show when={!isNearBottom[0]()}>
      <button
        type="button"
        onClick={scrollToPresent}
        title={t('messages.jumpToPresent')}
        aria-label={t('messages.jumpToPresent')}
        class="absolute end-4 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-card/85 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl transition-colors hover:bg-accent bottom-[calc(var(--composer-height,0px)+1rem)]"
      >
        <i class="fa-solid fa-arrow-down text-xs" aria-hidden="true" />
      </button>
    </Show>
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
