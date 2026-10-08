import { MessageThreadFooter } from './messageList/MessageThreadFooter';
import type { ThreadIntroInfo } from './messageList/MessageListIntro';
import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show, on, onCleanup, onMount, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { DecryptedMessage } from '../stores/messages';
import {
  messages,
  setMessages,
  editMessage as editMessageInStore,
  toggleReaction,
  enterRoomView,
  leaveRoomView,
  type JumpTarget,
} from '../stores/messages';
import type { RoomParticipant } from '../api/rooms';
import type { SpaceRole } from '../api/spaces';
import { auth } from '../stores/auth';
import { settings } from '../stores/settings';
import { messageIdGt } from '../stores/readState';
import { newHeaderDismissed } from '../stores/newHeaderDismissed';
import { formatMessageTimestamp, formatDateHeader, formatTimeOfDay } from '../lib/utils/datetime';
import { t } from '../i18n';
import { BotTag } from './BotTag';
import { OfficialTag } from './OfficialTag';
import { showContextMenu } from '../stores/contextMenu';
import { onEditLastMessageRequest } from '../lib/chatShortcuts';
import { buildUserMenuItems, buildSpaceModerationItems } from '../lib/userContextMenu';
import { isBlocked } from '../stores/relationships';
import { openReportDialog } from './ReportDialog';
import { deleteMessage as deleteMessageApi } from '../api/messages';
import { Tooltip } from './ui/Tooltip';
import {
  getMessageBodyText,
  isEdited,
  getSenderDisplay,
  augmentParticipants,
  isSystemMessage,
  formatSystemMessageText,
  MessageAvatar,
  MessageBody,
  DeleteMessageModal,
  MessageListIntro,
  HistoryEdge,
  ReplyReference,
  MessageReactions,
  MessageEditBox,
} from './messageList';
import { appFloatToolbar, zLayer } from '../theme/appChrome';
import { MessageAttachments } from './messageList/MessageAttachments';
import { EmojiPicker, type EmojiPick } from './emoji/EmojiPicker';
import { IconButton } from './ui/IconButton';
import { pinMessage, unpinMessage } from '../stores/pinnedMessages';
import { openUserProfilePopover } from '../stores/userProfilePopover';
import { popoverSubjectFromSender } from '../lib/userProfilePopoverHelpers';
import { memberNameColorHex, viewerRoleCeiling } from '../lib/spacePermissions';
import { flashMessageRow } from '../lib/utils/messages';
import { captureScrollAnchor } from '../lib/scrollAnchor';
import { recallScrollPosition, rememberScrollPosition, type SavedScrollPosition } from '../lib/scrollPositions';

const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;
/** Treat as “at bottom” if within this many px. */
const BOTTOM_THRESHOLD_PX = 24;
/** Page in the next batch once the edge of the loaded window is within this of the viewport. */
const EDGE_LOAD_MARGIN_PX = 400;
/** How long a jump waits for its row to appear before giving up. */
const JUMP_ROW_WAIT_MS = 2000;
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
  hasMoreOlder?: boolean;
  onLoadOlder?: (getScrollContainer: () => HTMLDivElement | undefined) => void;
  /** True when there are newer messages below the loaded window - set after a jump to older
   * history (reply target / search hit). Drives downward infinite scroll and keeps the
   * jump-to-present affordance visible even when sitting at the window's bottom. */
  hasMoreNewer?: boolean;
  /** Page in the next batch of newer messages (downward infinite scroll out of a jump). */
  onLoadNewer?: (getScrollContainer: () => HTMLDivElement | undefined) => void;
  /** Reload the live tail, replacing a jumped-to window (the "jump to present" action). */
  onJumpToPresent?: () => void;
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
  /** Space text channels: offers "Create thread" on a message (omitted in threads and for
   * members without Create Public Threads). */
  onCreateThread?: (message: DecryptedMessage) => void;
  /** Threads: who started it and the starter message, for the intro. */
  threadIntro?: ThreadIntroInfo;
  /** When false, adding a new reaction is disabled (existing reactions still show, and the
   * viewer can still remove their own). Default true (DMs / non-space rooms). */
  canReact?: boolean;
  /** May click an existing reaction pill to join it. Discord asks only Read Message History
   * for that; Add Reactions (canReact) is needed to start a new one. Defaults to canReact. */
  canJoinReactions?: boolean;
  /** When set, the reaction picker offers only this space's custom emoji (viewer lacks Use
   * External Emojis in the room). */
  customEmojiSpaceId?: string;
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
  /** Space moderation, mirrored from the member list so the author menu offers the same
   * kick/ban actions. Omitted in DMs/groups, where kick/ban don't apply. */
  canKickMembers?: boolean;
  canBanMembers?: boolean;
  viewerHighestRolePosition?: number;
  onKickMember?: (userId: string) => void;
  onBanMember?: (userId: string) => void;
  /** Open DM with user (profile popover). */
  onMessageUser?: (userId: string) => void;
}

export const MessageList: Component<MessageListProps> = (props) => {
  const listRef = createSignal<HTMLDivElement>();
  const contentRef = createSignal<HTMLDivElement>();
  const sentinelRef = createSignal<HTMLDivElement>();
  const bottomSentinelRef = createSignal<HTMLDivElement>();
  const isNearBottom = createSignal(true);
  /** True shortly after the user moves the scroll viewport (don’t auto-scroll over them). */
  const [isUserScrolling, setIsUserScrolling] = createSignal(false);
  /** Set while MessageList scrolls itself so `onScroll` does not flip user-scrolling state. */
  const programmaticScrollRef = { current: false };
  /** Whether to keep the view glued to the newest message. Only a *user* scroll away from the
   * bottom clears it; content growing (images/GIFs/emoji loading in) must not, or the re-pin
   * below would give up exactly when it's needed. */
  const stickToBottom = { current: true };
  const [editingMessageId, setEditingMessageId] = createSignal<string | null>(null);
  const [editDraft, setEditDraft] = createSignal('');
  const [pendingDelete, setPendingDelete] = createSignal<{ roomId: string; msgId: string; message: DecryptedMessage } | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = createSignal<string | null>(null);
  // Reaction picker: portaled to <body> and positioned against the message row, so the room's
  // overflow-hidden scroll area can't clip the card. It opens downward from the row, flips to
  // open upward when there isn't room below (a message near the bottom), and shrinks to fit a
  // short viewport - measured on open and on resize/scroll.
  const REACTION_PICKER_W = 352; // 22rem
  const REACTION_PICKER_H = 416; // 26rem
  const [reactionAnchor, setReactionAnchor] = createSignal<
    { left: number; top: number; width: number; height: number } | null
  >(null);
  const measureReactionAnchor = () => {
    const id = reactionPickerFor();
    if (!id) return;
    const row = document.querySelector(`[data-msg-id="${id}"]`);
    if (!row) return;
    const r = row.getBoundingClientRect();
    const margin = 8;
    const height = Math.min(REACTION_PICKER_H, window.innerHeight - margin * 2);
    const width = Math.min(REACTION_PICKER_W, window.innerWidth - margin * 2);
    let top = r.top;
    if (top + height > window.innerHeight - margin) top = r.bottom - height; // flip up near the bottom
    top = Math.max(margin, Math.min(top, window.innerHeight - margin - height));
    let left = r.right - width; // reactions live at the row's end; right-align, then clamp
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
    setReactionAnchor({ left, top, width, height });
  };
  createEffect(() => {
    if (!reactionPickerFor()) {
      setReactionAnchor(null);
      return;
    }
    measureReactionAnchor();
    const onReflow = () => measureReactionAnchor();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    onCleanup(() => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    });
  });

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
  // Room participants plus any users the messages embed (author / mention_users /
  // referenced_message.author), so a sender or mention the client never cached still
  // resolves to a name + avatar. Same reference when nothing new is added.
  const resolvedParticipants = createMemo(() => augmentParticipants(props.participants, props.messages));
  // Whether a message pings the current user - reads the server-authoritative signal
  // (mention_everyone / the resolved `mentions` list, which includes the author's own id when
  // they @mention themselves). Your own messages highlight too when they actually mention you
  // (`@you` or `@everyone`), matching what you'd see from anyone else - the mention *count*
  // still excludes your own messages, that's a separate server-side concern.
  const mentionsCurrentUser = (msg: DecryptedMessage): boolean => {
    const uid = currentUserId();
    if (!uid) return false;
    if (msg.mention_everyone === true) return true;
    return msg.mentions?.some((m) => String(m) === uid) ?? false;
  };
  const compact = () => (props.compact !== undefined ? props.compact : settings.messageCompact);
  // Link previews always render in non-encrypted rooms; in E2EE rooms only when the user opts
  // in (unfurling sends the link to the server, which it otherwise never sees there).
  const allowLinkPreviews = () => props.e2eeEnabled !== true || settings.linkPreviewsInEncrypted;
  const canReact = () => props.canReact !== false;
  const canJoinReactions = () => props.canJoinReactions ?? canReact();

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
    stashPosition();
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
    const s = getSenderDisplay(msg.sender_id, resolvedParticipants(), currentUserId());
    const participant = resolvedParticipants()?.find((x) => x.id === msg.sender_id);
    const items = buildUserMenuItems({
      userId: msg.sender_id,
      bot: s.bot,
      username: s.username || '',
      displayName: s.name,
      homeDomain: s.homeDomain,
      currentUserId: currentUserId(),
      onMessage: props.onMessageUser,
      spaceId: props.spaceId,
      roomId: props.roomId,
      extraItems: buildSpaceModerationItems({
        spaceId: props.spaceId,
        targetUserId: msg.sender_id,
        targetRoleIds: (participant as { roles?: string[] } | undefined)?.roles,
        currentUserId: currentUserId(),
        spaceOwnerId: props.spaceOwnerId,
        spaceRoles: props.spaceRoles,
        viewerHighestRolePosition: props.viewerHighestRolePosition,
        canKickMembers: props.canKickMembers,
        canBanMembers: props.canBanMembers,
        onKick: props.onKickMember,
        onBan: props.onBanMember,
      }),
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
    const s = getSenderDisplay(userId, resolvedParticipants(), uid);
    const p = resolvedParticipants()?.find((x) => x.id === userId);
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
            viewerHighestPosition: viewerRoleCeiling(props.spaceOwnerId, uid, props.spaceRoles, resolvedParticipants()),
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

  // ↑ in the empty composer edits the user's most recent message here (Discord-style). The
  // composer relays it as an event since it's a sibling with no shared state; we find the last
  // own, real (non-pending, non-system) message and open the inline editor on it.
  onMount(() => {
    const off = onEditLastMessageRequest(() => {
      if (editingMessageId()) return;
      const uid = currentUserId();
      if (!uid) return;
      for (let i = props.messages.length - 1; i >= 0; i--) {
        const m = props.messages[i]!;
        if (m.sender_id === uid && !isSystemMessage(m) && /^\d+$/.test(m.id) && !m.pending) {
          setEditDraft(getMessageBodyText(m));
          setEditingMessageId(m.id);
          queueMicrotask(() =>
            listRef[0]?.()?.querySelector(`[data-msg-id="${m.id}"]`)?.scrollIntoView({ block: 'nearest' })
          );
          break;
        }
      }
    });
    onCleanup(off);
  });

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

  /**
   * Scroll positions we set ourselves and haven't yet seen echoed back as a scroll event.
   * onScroll tells our own scrolls from the user's by where they land, not by a timer: setting
   * scrollTop (especially right after removing rows during a trim) can emit its scroll event a
   * frame after the rAF that would clear a boolean guard, which is exactly when a live-tail trim
   * would otherwise be mistaken for the user scrolling and stop the view following new messages.
   */
  const ownScrolls: Array<{ top: number; t: number }> = [];
  function noteOwnScroll(el: HTMLDivElement | undefined) {
    if (!el) return;
    const now = performance.now();
    while (ownScrolls.length && now - ownScrolls[0]!.t > 1000) ownScrolls.shift();
    ownScrolls.push({ top: Math.round(el.scrollTop), t: now });
    if (ownScrolls.length > 8) ownScrolls.shift();
  }
  /** True if `scrollTop` is a position we just set ourselves (consumes the match). */
  function isOwnScroll(scrollTop: number): boolean {
    const now = performance.now();
    for (let i = 0; i < ownScrolls.length; i++) {
      if (now - ownScrolls[i]!.t <= 1000 && Math.abs(ownScrolls[i]!.top - scrollTop) <= 2) {
        ownScrolls.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  /** Scroll the viewport ourselves without it reading as a user scroll (which re-aims stickToBottom). */
  function programmatic(run: () => void) {
    programmaticScrollRef.current = true;
    run();
    noteOwnScroll(listRef[0]?.());
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }
  /** Reduced motion turns every animated scroll into a snap. */
  const scrollBehavior = (): ScrollBehavior =>
    document.documentElement.classList.contains('reduce-motion') ? 'auto' : 'smooth';
  const distanceToBottom = (el: HTMLDivElement) => el.scrollHeight - el.scrollTop - el.clientHeight;
  function syncNearBottom(el: HTMLDivElement) {
    const near = distanceToBottom(el) <= BOTTOM_THRESHOLD_PX;
    isNearBottom[1](near);
    props.onNearBottomChange?.(near);
  }
  /** The list runs under the floating composer; the usable viewport ends above it. */
  function visibleViewportHeight(el: HTMLDivElement): number {
    const content = contentRef[0]?.();
    const pad = content ? parseFloat(getComputedStyle(content).paddingBottom) || 0 : 0;
    return Math.max(0, el.clientHeight - pad);
  }
  /** scrollTop that puts `row` in the middle of the usable viewport. */
  function centeredScrollTop(el: HTMLDivElement, row: HTMLElement): number {
    const rowTop = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    const free = Math.max(0, visibleViewportHeight(el) - row.offsetHeight);
    return Math.max(0, rowTop - free / 2);
  }
  /** Pending re-snaps from the last landing / forced scroll; cancelled by the next one. */
  let settle: (() => void) | null = null;
  onCleanup(() => settle?.());
  /** Snap to the newest message now, then again as late layout (images, previews) settles. */
  function scrollToBottomSettled(el: HTMLDivElement) {
    settle?.();
    const snap = () => programmatic(() => el.scrollTo({ top: el.scrollHeight, behavior: 'auto' }));
    snap();
    const rafId = requestAnimationFrame(snap);
    const timeoutId = setTimeout(snap, SCROLL_TO_BOTTOM_DELAY_MS);
    settle = () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      settle = null;
    };
  }
  /** Scroll so `row` sits `offset` px below the top, now and once more after layout settles. */
  function scrollRowToTop(el: HTMLDivElement, row: HTMLElement, offset: number) {
    settle?.();
    const place = () =>
      programmatic(() => {
        const relativeTop = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        el.scrollTo({ top: Math.max(0, relativeTop - offset), behavior: 'auto' });
      });
    place();
    const rafId = requestAnimationFrame(place);
    settle = () => {
      cancelAnimationFrame(rafId);
      settle = null;
    };
  }

  /** Last known place in the viewport, refreshed on scroll idle and content changes; it is
   * what a later visit to this room comes back to. */
  let positionStash: SavedScrollPosition | null = null;
  function stashPosition() {
    const el = listRef[0]?.();
    if (!el || !props.roomId || landedRoom !== props.roomId) return;
    const anchor = captureScrollAnchor(el);
    positionStash = { anchorId: anchor.id, top: anchor.top, atBottom: stickToBottom.current };
  }
  // The store anchors this room's trims through our container while it is on screen. On the
  // way out (room switch or unmount) the position is saved so coming back lands on the same
  // row, and the store shrinks the room's cache around it.
  createEffect(() => {
    const roomId = props.roomId;
    positionStash = null;
    if (!roomId) return;
    enterRoomView(roomId, { container: getScrollContainer, programmatic });
    onCleanup(() => {
      if (positionStash) rememberScrollPosition(roomId, positionStash);
      leaveRoomView(roomId, positionStash);
    });
  });

  /** Page in at whichever edge the viewport is approaching. The observers below do the same;
   * this also covers a scroll that stops inside the margin without crossing into view. */
  function maybeLoadEdges(el: HTMLDivElement, roomId: string) {
    if (props.messages.length === 0) return;
    const rect = el.getBoundingClientRect();
    const top = sentinelRef[0]?.();
    if (
      top?.isConnected &&
      props.onLoadOlder &&
      (messages.hasMoreOlder[roomId] ?? true) &&
      !(messages.loadingOlder[roomId] ?? false) &&
      top.getBoundingClientRect().bottom - rect.top > -EDGE_LOAD_MARGIN_PX
    ) {
      props.onLoadOlder(getScrollContainer);
    }
    const bottom = bottomSentinelRef[0]?.();
    if (
      bottom?.isConnected &&
      props.onLoadNewer &&
      (messages.hasMoreNewer[roomId] ?? false) &&
      !(messages.loadingNewer[roomId] ?? false) &&
      bottom.getBoundingClientRect().top - rect.bottom < EDGE_LOAD_MARGIN_PX
    ) {
      props.onLoadNewer(getScrollContainer);
    }
  }

  // Scroll tracking: user vs. our own scrolls, near-bottom state, paging at either edge.
  createEffect(() => {
    const el = listRef[0]?.();
    const roomId = props.roomId;
    if (!el || !roomId) return;
    let userScrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const near = distanceToBottom(el) <= BOTTOM_THRESHOLD_PX;
      if (!programmaticScrollRef.current && !isOwnScroll(el.scrollTop)) {
        setIsUserScrolling(true);
        if (userScrollIdleTimer) clearTimeout(userScrollIdleTimer);
        userScrollIdleTimer = setTimeout(() => {
          userScrollIdleTimer = null;
          setIsUserScrolling(false);
          stashPosition();
        }, USER_SCROLL_IDLE_MS);
        // A user scroll is the only thing that starts or stops "follow the newest message".
        stickToBottom.current = near;
      }
      isNearBottom[1](near);
      props.onNearBottomChange?.(near);
      maybeLoadEdges(el, roomId);
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

  /** The row for `id`, or failing that (deleted, filtered out) the nearest one by id. */
  function rowFor(el: HTMLDivElement, id: string): { row: HTMLElement; exact: boolean } | null {
    const exact = el.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (exact) return { row: exact, exact: true };
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-msg-id]'));
    const after = rows.find((r) => messageIdGt(r.getAttribute('data-msg-id') ?? '', id));
    const row = after ?? rows[rows.length - 1];
    return row ? { row, exact: false } : null;
  }

  /**
   * Centre a jumped-to message and flash it. The target is consumed first so nothing else
   * acts on it; the row is polled for briefly in case it hasn't rendered yet (a window that
   * just arrived for another channel). Only a target already on the page animates.
   */
  function applyJump(el: HTMLDivElement, roomId: string, target: JumpTarget, allowSmooth: boolean) {
    setMessages('jumpTarget', roomId, null);
    settle?.();
    stickToBottom.current = false;
    const started = Date.now();
    const attempt = () => {
      if (props.roomId !== roomId) return;
      const hit = rowFor(el, target.id);
      if (!hit) {
        if (Date.now() - started < JUMP_ROW_WAIT_MS) setTimeout(attempt, 100);
        return;
      }
      const top = centeredScrollTop(el, hit.row);
      if (allowSmooth && target.smooth) {
        // Reads as a user scroll on purpose: it moves "follow the newest" to wherever it ends.
        el.scrollTo({ top, behavior: scrollBehavior() });
      } else {
        programmatic(() => el.scrollTo({ top, behavior: 'auto' }));
      }
      syncNearBottom(el);
      if (hit.exact) flashMessageRow(hit.row);
    };
    attempt();
  }

  /**
   * Where to start when a room's content first shows: a pending jump target; else the spot
   * the viewer left this room at (Discord keeps it for the session); else, the first time
   * this room is shown this session, the first-unread divider instead of straight to the
   * bottom past it; else the bottom. Only a landing at the bottom follows new messages.
   */
  function land(el: HTMLDivElement, roomId: string) {
    const target = messages.jumpTarget[roomId];
    if (target) {
      applyJump(el, roomId, target, false);
      return;
    }
    const saved = recallScrollPosition(roomId);
    if (saved && !saved.atBottom && saved.anchorId) {
      const row = el.querySelector<HTMLElement>(`[data-msg-id="${saved.anchorId}"]`);
      if (row) {
        stickToBottom.current = false;
        scrollRowToTop(el, row, saved.top);
        syncNearBottom(el);
        return;
      }
    }
    const isInitialView = !roomsWithInitialScrollDone.has(roomId);
    roomsWithInitialScrollDone.add(roomId);
    const unreadIdx = isInitialView ? firstUnreadIndex() : -1;
    const unread = unreadIdx !== -1 ? props.messages[unreadIdx] : undefined;
    const unreadRow = unread ? el.querySelector<HTMLElement>(`[data-msg-id="${unread.id}"]`) : null;
    if (unreadRow) {
      stickToBottom.current = false;
      scrollRowToTop(el, unreadRow, 96);
      syncNearBottom(el);
      return;
    }
    stickToBottom.current = true;
    scrollToBottomSettled(el);
    isNearBottom[1](true);
    props.onNearBottomChange?.(true);
  }

  // Land once per room entry, as soon as its rows exist. Tracks the message count only so a
  // room whose first page arrives after mount still lands; later changes don't re-land.
  let landedRoom: string | undefined;
  createEffect(() => {
    const roomId = props.roomId;
    const el = listRef[0]?.();
    const count = props.messages.length;
    if (!el || !roomId || count === 0 || landedRoom === roomId) return;
    landedRoom = roomId;
    untrack(() => land(el, roomId));
  });

  // A jump while already in the room (reply reference, search hit, pinned message). On entry
  // the landing above consumes the target first, so this sees nothing to do.
  createEffect(() => {
    const roomId = props.roomId;
    const el = listRef[0]?.();
    const target = roomId ? messages.jumpTarget[roomId] : null;
    if (!roomId || !el || !target || landedRoom !== roomId) return;
    untrack(() => applyJump(el, roomId, target, true));
  });

  // The two tick effects below only act on a bump within the current room: the first run
  // (prev undefined) and a run caused by the room changing just record the new baseline. Not
  // `defer: true` - on() doesn't record its input on a deferred first run, so the guard would
  // also swallow the first real bump after entering a room.

  // A message appended at the live bottom: follow it only if the viewer was already there and
  // isn't mid-scroll. (The ResizeObserver below covers the same ground for content growth.)
  createEffect(
    on(
      () => [props.roomId, props.roomId ? messages.scrollToBottomTick[props.roomId] ?? 0 : 0] as const,
      ([roomId, tick], prev) => {
        const el = listRef[0]?.();
        if (!el || !roomId || !tick || !prev || prev[0] !== roomId || landedRoom !== roomId) return;
        if (!stickToBottom.current || isUserScrolling()) return;
        programmatic(() => el.scrollTo({ top: el.scrollHeight, behavior: 'auto' }));
      }
    )
  );

  // Taken to the live bottom regardless: own send, "jump to present".
  createEffect(
    on(
      () => [props.roomId, props.roomId ? messages.scrollToBottomForce[props.roomId] ?? 0 : 0] as const,
      ([roomId, tick], prev) => {
        const el = listRef[0]?.();
        if (!el || !roomId || !tick || !prev || prev[0] !== roomId) return;
        stickToBottom.current = true;
        scrollToBottomSettled(el);
        isNearBottom[1](true);
        props.onNearBottomChange?.(true);
      }
    )
  );

  // Re-pin to the true bottom as late content (images, GIFs, avatars, emoji) finishes loading
  // and grows the list. The initial scroll-to-bottom measures scrollHeight before those load,
  // so without this you enter a room landed slightly *above* the newest message and have to
  // nudge down. A ResizeObserver on the content re-snaps to the bottom whenever it grows, but
  // only while stickToBottom is set - reading history is never yanked.
  createEffect(() => {
    const content = contentRef[0]?.();
    const el = listRef[0]?.();
    if (!content || !el) return;
    const repin = () => {
      if (!stickToBottom.current || isUserScrolling()) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 1) return; // already exactly there
      programmatic(() => {
        el.scrollTop = el.scrollHeight;
      });
    };
    const ro = new ResizeObserver(repin);
    ro.observe(content);
    onCleanup(() => ro.disconnect());
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
      { root: listEl, rootMargin: `${EDGE_LOAD_MARGIN_PX}px 0px 0px 0px`, threshold: 0 }
    );
    const t = setTimeout(() => io.observe(sentinel), IO_OBSERVE_DELAY_MS);
    onCleanup(() => {
      clearTimeout(t);
      io.disconnect();
    });
  });

  // IntersectionObserver: load newer when the bottom sentinel scrolls into view - only while a
  // jumped-to window still has newer messages to page in. Gated on hasMoreNewer so the sentinel,
  // which sits at the live bottom in a normal room, doesn't fire constantly. Mirrors the loader above.
  createEffect(() => {
    const roomId = props.roomId;
    const sentinel = bottomSentinelRef[0]?.();
    const listEl = listRef[0]?.();
    const hasNewer = roomId ? (messages.hasMoreNewer[roomId] ?? false) : false;
    const loading = roomId ? (messages.loadingNewer[roomId] ?? false) : false;
    if (!roomId || !sentinel || !listEl || !hasNewer || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        if (props.messages.length > 0) props.onLoadNewer?.(getScrollContainer);
      },
      { root: listEl, rootMargin: `0px 0px ${EDGE_LOAD_MARGIN_PX}px 0px`, threshold: 0 }
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
    if (props.roomType !== 1 || !currentUserId() || !resolvedParticipants()?.length) return undefined;
    return resolvedParticipants().find((p) => p.id !== currentUserId());
  };

  /** True if this is the current user's notes room (self-PM). */
  const isNotes = () =>
    props.roomType === 1 &&
    resolvedParticipants()?.length === 1 &&
    currentUserId() &&
    resolvedParticipants()[0]?.id === currentUserId();

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
    const roomId = props.roomId;
    // In a jumped-to window the window's own bottom isn't the live present - reload the tail
    // (the parent replaces the window and scrolls to bottom) rather than scrolling within it.
    if (roomId && (messages.hasMoreNewer[roomId] ?? false)) {
      props.onJumpToPresent?.();
      return;
    }
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
      <div
        ref={(el) => contentRef[1](el)}
        class="flex flex-col p-4 gap-2 min-h-full justify-end pb-[calc(var(--composer-height,0px)+0.25rem)]"
      >
        {/* The room's beginning only once history is exhausted; above an unfinished window
            the skeleton edge stands in for the pages still to come. */}
        <Show when={props.messages.length === 0 || !(props.hasMoreOlder ?? true)}>
          <MessageListIntro
            roomType={props.roomType}
            roomName={props.roomName}
            pmOther={pmOther()}
            isNotes={!!isNotes()}
            e2eeEnabled={props.e2eeEnabled}
            thread={props.threadIntro}
          />
        </Show>
        <HistoryEdge
          more={props.messages.length > 0 && (props.hasMoreOlder ?? true)}
          side="older"
          sentinelRef={(el) => sentinelRef[1](el)}
        />
        <For each={visibleMessages()}>
          {(msg, i) => {
            const prev = () => visibleMessages()[i() - 1];
            const showHeader = () => shouldShowHeader(msg, prev());
            const needsDateHeader = () => shouldShowDateHeader(msg, prev());
            const sender = () =>
              getSenderDisplay(msg.sender_id, resolvedParticipants(), currentUserId());
            /**
             * Discord-style: the sender's name takes their highest hoisted role's colour.
             * Read off the participant's roles, never presence, so an author's colour in
             * history doesn't depend on whether they're online right now.
             */
            const senderNameColor = () => {
              const p = resolvedParticipants()?.find((x) => x.id === msg.sender_id);
              return memberNameColorHex((p as { roles?: string[] } | undefined)?.roles, props.spaceRoles);
            };
            /** `text-foreground` must yield to the role colour, not fight it. */
            const senderNameClass = () =>
              `shrink-0 cursor-pointer rounded px-0.5 -mx-0.5 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                senderNameColor() ? '' : 'text-foreground'
              }`;
            const senderNameStyle = () =>
              senderNameColor() ? { color: senderNameColor() } : undefined;

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
                  class={`flex gap-3 -mx-2 px-2 rounded-md group relative transition-colors ${
                    mentionsCurrentUser(msg)
                      ? 'bg-primary/10 md:hover:bg-primary/15 shadow-[inset_2px_0_0_0_var(--color-primary)]'
                      : 'md:hover:bg-muted/40'
                  } ${
                    compact() ? 'py-0.5' : 'py-0.5'
                  } ${
                    showHeader() ? (prev() ? 'mt-[var(--space-message-group)]' : '') : compact() ? '-mt-0.5' : '-mt-1'
                  }`}
                  onContextMenu={(e) => {
                    const roomId = props.roomId;
                    const bodyText = getMessageBodyText(msg);
                    const isOwn = msg.sender_id === currentUserId();
                    const pinned = msg.pinned === true;
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
                      ...(props.onCreateThread && !msg.thread_id
                        ? [
                            {
                              label: t('threads.createFromMessage'),
                              icon: 'fa-comments',
                              onClick: () => props.onCreateThread?.(msg),
                            },
                          ]
                        : []),
                      ...(props.roomId && props.canManageMessages !== false
                        ? [
                            {
                              label: pinned ? t('messages.actions.unpin') : t('messages.actions.pin'),
                              icon: 'fa-thumbtack',
                              onClick: () =>
                                void (pinned ? unpinMessage(props.roomId, msg.id) : pinMessage(props.roomId, msg.id)).catch(
                                  (err) => console.error('Pin toggle failed:', err)
                                ),
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
                                const s = getSenderDisplay(msg.sender_id, resolvedParticipants(), currentUserId());
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
                          ]
                        : []),
                      // Delete: your own message anywhere, or anyone's here with Manage Messages
                      // (the backend enforces the same - PermManageMessages in a space text room).
                      ...((isOwn || props.canManageMessages === true) && roomId
                        ? [
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
                        <span class="w-10 select-none whitespace-nowrap tabular-nums text-center text-[10px] leading-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
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
                    <MessageEditBox
                      initialValue={editDraft()}
                      onCancel={() => setEditingMessageId(null)}
                      onSave={(text) => {
                        editMessageInStore(props.roomId!, msg.id, text)
                          .then(() => setEditingMessageId(null))
                          .catch((err) => console.error('Edit failed:', err));
                      }}
                    />
                  </Show>
                  <Show when={editingMessageId() !== msg.id}>
                  <Show when={msg.reply_to_id}>
                    {(replyToId) => (
                      <ReplyReference
                        replyToId={replyToId()}
                        roomId={props.roomId}
                        messages={props.messages}
                        referenced={msg.referenced_message as DecryptedMessage | undefined}
                        participants={resolvedParticipants()}
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
                        class={`text-sm font-semibold ${senderNameClass()}`}
                        style={senderNameStyle()}
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
                      <BotTag bot={sender().bot} size="sm" class="-ms-0.5" />
                      <OfficialTag system={sender().system} size="sm" class="-ms-0.5" />
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
                          participants={resolvedParticipants()}
                          spaceRoles={props.spaceRoles}
                          onMentionClick={openProfileForUser}
                          allowLinkPreviews={allowLinkPreviews()}
                          trailing={
                            <Show when={isEdited(msg)}>
                              <Tooltip label={t('messages.editedAt', { time: formatMessageTimestamp(new Date(msg.updated_at!)) })} inline side="top">
                                <span class="text-[10px] text-muted-foreground/80 ms-1 cursor-default">{t('messages.edited')}</span>
                              </Tooltip>
                            </Show>
                          }
                        />
                      </span>
                      {/* <Show when={msg.notEncrypted && !msg.pending && props.e2eeEnabled !== false}>
                        <span class="text-[10px] text-amber-500/90 shrink-0">Not encrypted</span>
                      </Show> */}
                    </div>
                    <Show when={msg.attachments?.length}>
                      <MessageAttachments attachments={msg.attachments!} />
                    </Show>
                    <Show when={msg.thread_id}>
                      {(tid) => <MessageThreadFooter threadId={tid()} spaceId={props.spaceId} />}
                    </Show>
                    <Show when={msg.reactions?.length}>
                      <MessageReactions
                        roomId={props.roomId!}
                        messageId={msg.id}
                        reactions={msg.reactions!}
                        canReact={canJoinReactions()}
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
                        class={`text-sm font-semibold truncate ${senderNameClass()}`}
                        style={senderNameStyle()}
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
                        <BotTag bot={sender().bot} size="sm" class="-ms-0.5" />
                      <OfficialTag system={sender().system} size="sm" class="-ms-0.5" />
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
                        participants={resolvedParticipants()}
                        spaceRoles={props.spaceRoles}
                        onMentionClick={openProfileForUser}
                        allowLinkPreviews={allowLinkPreviews()}
                        trailing={
                          <Show when={isEdited(msg)}>
                            <Tooltip label={t('messages.editedAt', { time: formatMessageTimestamp(new Date(msg.updated_at!)) })} inline side="top">
                              <span class="text-[10px] text-muted-foreground/80 ms-1 cursor-default align-baseline">{t('messages.edited')}</span>
                            </Tooltip>
                          </Show>
                        }
                      />
                      {/* <Show when={msg.notEncrypted && !msg.pending && props.e2eeEnabled !== false}>
                        <span class="text-[10px] text-amber-500/90">Not encrypted</span>
                      </Show> */}
                    </div>
                    <Show when={msg.attachments?.length}>
                      <MessageAttachments attachments={msg.attachments!} />
                    </Show>
                    <Show when={msg.thread_id}>
                      {(tid) => <MessageThreadFooter threadId={tid()} spaceId={props.spaceId} />}
                    </Show>
                    <Show when={msg.reactions?.length}>
                      <MessageReactions
                        roomId={props.roomId!}
                        messageId={msg.id}
                        reactions={msg.reactions!}
                        canReact={canJoinReactions()}
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
                  <Show when={props.onCreateThread && !msg.thread_id}>
                    <Tooltip label={t('threads.createFromMessage')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-comments"
                        label={t('threads.createFromMessage')}
                        title=""
                        onClick={(e) => {
                          e.preventDefault();
                          props.onCreateThread?.(msg);
                        }}
                      />
                    </Tooltip>
                  </Show>
                  <Show when={props.roomId && props.canManageMessages !== false}>
                    <Tooltip label={msg.pinned === true ? t('messages.actions.unpin') : t('messages.actions.pin')} inline side="top">
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-thumbtack"
                        label={msg.pinned === true ? t('messages.actions.unpin') : t('messages.actions.pin')}
                        title=""
                        active={msg.pinned === true}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!props.roomId) return;
                          void (msg.pinned ? unpinMessage(props.roomId, msg.id) : pinMessage(props.roomId, msg.id)).catch(
                            (err) => console.error('Pin toggle failed:', err)
                          );
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
                  </Show>
                  <Show when={props.roomId && (msg.sender_id === currentUserId() || props.canManageMessages === true)}>
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
                <Show when={reactionPickerFor() === msg.id && reactionAnchor()}>
                  {(anchor) => (
                    <Portal>
                      <div
                        class={`fixed ${zLayer.popover}`}
                        style={{
                          left: `${anchor().left}px`,
                          top: `${anchor().top}px`,
                          width: `${anchor().width}px`,
                          height: `${anchor().height}px`,
                        }}
                      >
                        <EmojiPicker onClose={() => setReactionPickerFor(null)} onPick={(pick) => pickReaction(msg, pick)} customEmojiSpaceId={props.customEmojiSpaceId} />
                      </div>
                    </Portal>
                  )}
                </Show>
              </div>
                )}
              >
                <div class="flex justify-center py-2" data-msg-id={msg.id}>
                  <span class="text-xs text-muted-foreground">
                    {formatSystemMessageText(
                      msg as DecryptedMessage & { system_type: string; system_payload: string },
                      resolvedParticipants(),
                      currentUserId()
                    )}
                  </span>
                </div>
              </Show>
              </>
            );
          }}
        </For>
        {/* Past the newest loaded row while the window hasn't reconnected with the live tail:
            scrolling toward it pages newer messages in. Absent in a room sitting at the tail. */}
        <HistoryEdge
          more={props.messages.length > 0 && (props.hasMoreNewer ?? false)}
          side="newer"
          sentinelRef={(el) => bottomSentinelRef[1](el)}
        />
      </div>
    </div>
    {/* Reading an older window (a jump, or history read far enough back that the tail was
        unloaded): Discord's bar above the composer, with the way back to the present. */}
    <Show when={props.hasMoreNewer}>
      <div
        class="absolute inset-x-4 z-10 flex items-center justify-between gap-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg shadow-black/20 bottom-[calc(var(--composer-height,0px)+0.75rem)]"
        data-viewing-older
      >
        <span class="min-w-0 truncate">{t('messages.viewingOlder')}</span>
        <button
          type="button"
          onClick={scrollToPresent}
          class="flex shrink-0 items-center gap-1.5 rounded px-1 py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
        >
          {t('messages.jumpToPresent')}
          <i class="fa-solid fa-arrow-down text-[10px]" aria-hidden="true" />
        </button>
      </div>
    </Show>
    <Show when={!isNearBottom[0]() && !props.hasMoreNewer}>
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
      participants={resolvedParticipants()}
      currentUserId={currentUserId()}
      onConfirm={doDelete}
      onCancel={() => setPendingDelete(null)}
    />
    </>
  );
};
