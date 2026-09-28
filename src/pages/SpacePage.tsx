import type { Component } from 'solid-js';
import {
  createMemo,
  createResource,
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import {
  getSpaceRooms,
  kickSpaceMember,
  banSpaceMember,
  type SpaceMember,
  type SpaceRoom,
} from '../api/spaces';
import { spaces, setSpaceRooms, spaceRoles, ensureSpaceRoles, refreshSpaceRooms } from '../stores/spaces';
import {
  messages,
  setMessages,
  loadMessages,
  loadOlderMessages,
  sendMessage,
  type DecryptedMessage,
} from '../stores/messages';
import { rooms, addOrUpdateRoom } from '../stores/rooms';
import type { Room } from '../api/rooms';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { sendTyping } from '../api/rooms';
import { getTypingUserIds, removeTyping } from '../stores/typing';
import { auth } from '../stores/auth';
import { stargate } from '../stores/stargate';
import { readState, ackRoomOptimistic, messageIdGt, getUnreadBannerInfo } from '../stores/readState';
import { createViewportAck } from '../lib/viewportAck';
import { MessageList } from '../components/MessageList';
import { MessageSkeleton } from '../components/MessageSkeleton';
import {
  RoomComposerDock,
  RoomHeader,
  RoomMessageInput,
  RoomMembersSidebar,
  RoomSearchPanel,
  RoomPinnedPanel,
  UnreadBanner,
} from '../components/room';
import { MobileRailsOpenButton } from '../components/layout/MobileRailsOpenButton';
import { getMessageBodyText, getSenderDisplay, messagePreviewText } from '../components/messageList';
import { spaceMembers, loadSpaceMembers, ensureSpaceMembers } from '../stores/spaceMembers';
import { lastSpaceRoom } from '../stores/lastSpaceRoom';
import { createPM } from '../api/rooms';
import { dismissNewHeader, clearNewHeaderDismissed, newHeaderDismissed } from '../stores/newHeaderDismissed';
import { pinnedMessages } from '../stores/pinnedMessages';
import { settings, setMembersPanelOpen } from '../stores/settings';
import type { SettingsData } from '../stores/settings';
import { createComposerAutoFocus } from '../lib/composerFocus';
import { scrollToMessage, scrollToMessageWhenReady } from '../lib/utils/messages';
import { appPageHeader, appPageTitle, zLayer } from '../theme/appChrome';
import { confirmDialog } from '../stores/confirmDialog';
import { createAttachmentDraft } from '../lib/attachments/draft';
import { allCustomEmojis } from '../stores/customEmojis';
import { isRoomMuted, muteRoom, setRoomNotifyMode, unmuteRoom } from '../lib/roomNotify';
import {
  isMdViewport,
  mobileMembersOpen,
  setMobileMembersAvailable,
  setMobileMembersOpen,
} from '../stores/mobileShellLayout';
import { buildMentionCatalog, serializeDraft } from '../lib/utils/mentions';
import type { ReplyTarget, TypingPerson } from '../components/room';
import {
  canSendMessagesInChannel,
  effectiveChannelPermissionsForMember,
  hasPerm,
  memberCanBanMembers,
  memberCanKickMembers,
  memberCanManageRoles,
  memberHighestRolePosition,
  PermAddReactions,
  PermManageMessages,
  PermMentionEveryone,
  PermViewChannel,
} from '../lib/spacePermissions';
import { instance } from '../stores/instance';
import { VoiceStage } from '../components/voice/VoiceStage';
import { voiceStatesForRoom } from '../stores/voice';
import { t } from '../i18n';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
/** How often we re-announce "still typing" while the user keeps going. Must sit above
 * the server's 5s per-user rate limit (announcements inside it are dropped) and below
 * the client's 10s TTL, so a continuous typist never flickers out. */
const TYPING_PING_MS = 6000;

/** Convert SpaceRoom to Room so it can be added to rooms store (e.g. for sendMessage).
 * Must carry last_read_message_id/mention_count through: addOrUpdateRoom unconditionally
 * re-syncs readState from whatever Room it's given (setReadStateFromRoom does no merging),
 * and this conversion runs on every view of a text channel, not just once - dropping these
 * fields silently reset the real read cursor to null on every single visit, which is what
 * made the NEW divider "always come back" in space channels no matter how much was read. */
function spaceRoomToRoom(r: SpaceRoom, spaceId: string): Room {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    topic: r.topic,
    position: r.position,
    space_id: spaceId,
    parent_id: r.parent_id,
    last_message_id: r.last_message_id,
    last_read_message_id: r.last_read_message_id,
    mention_count: r.mention_count,
    // sendMessage/editMessage read this off the rooms-store copy to decide between the
    // plaintext and Megolm paths - dropping it would silently send every space message
    // as plaintext and get it rejected by the server for an E2EE room.
    e2ee_enabled: r.e2ee_enabled,
    created_at: r.created_at,
    updated_at: r.updated_at,
    recipients: [],
    participants: [],
  };
}

const SpacePage: Component = () => {
  const params = useParams<{ spaceId: string; roomId?: string }>();
  const navigate = useNavigate();
  const spaceId = () => params.spaceId;
  const roomId = () => params.roomId;
  const space = createMemo(() => spaces.spaces.find((s) => s.id === spaceId()));
  const [searchOpen, setSearchOpen] = createSignal(false);
  /** Raw text in the header search box, and the query the results panel is showing -
   * separate so typing doesn't re-run the search until Enter (Discord's behaviour). */
  const [searchDraft, setSearchDraft] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [pinnedOpen, setPinnedOpen] = createSignal(false);
  /** Measured height of the floating composer; the list pads itself by this much. */
  const [composerHeight, setComposerHeight] = createSignal(0);

  const [roomsRes] = createResource(spaceId, async (id) => {
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    const list = await getSpaceRooms(id);
    setSpaceRooms(id, list);
    return list;
  });

  // Roles live in the spaces store (delivered with the space in READY and patched by
  // SPACE_ROLE_* events); the ensure call only fetches for a space that arrived without them.
  createEffect(() => {
    const id = spaceId();
    if (id) void ensureSpaceRoles(id);
  });
  const spaceRolesRes = createMemo(() => {
    const id = spaceId();
    return id ? spaceRoles(id) : undefined;
  });
  const spaceRooms = createMemo(() => {
    const id = spaceId();
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    return roomsRes() ?? [];
  });
  const currentRoom = createMemo(() => {
    const id = roomId();
    if (!id) return null;
    return spaceRooms().find((r) => r.id === id) ?? null;
  });

  // Keyed on the room *id* (plus the E2EE flag, which the send path reads from the
  // rooms-store copy), not the room object: updateSpaceRoomLastMessage replaces the
  // SpaceRoom object on every incoming message, and re-running this per message pushed the
  // page-load read snapshot back into the store each time (addOrUpdateRoom syncs read
  // state), fighting the live viewport ack.
  createEffect(
    on(
      () => [currentRoom()?.id, currentRoom()?.type, spaceId(), currentRoom()?.e2ee_enabled] as const,
      ([id, type, sid]) => {
        if (!id || !sid || type !== ROOM_TYPE_TEXT) return;
        const room = untrack(() => currentRoom());
        if (!room) return;
        addOrUpdateRoom(spaceRoomToRoom(room, sid));
        lastSpaceRoom.set(sid, room.id);
      }
    )
  );

  const [draft, setDraft] = createSignal('');
  const attachmentDraft = createAttachmentDraft();
  const [cursorPos, setCursorPos] = createSignal(0);
  /** One typed character from the "just start typing" shortcut. */
  function appendToDraft(char: string) {
    setDraft((d) => {
      const next = d + char;
      queueMicrotask(() => setCursorPos(next.length));
      return next;
    });
  }

  const [inputRef, setInputRef] = createSignal<HTMLTextAreaElement | undefined>();
  const [replyToMessageId, setReplyToMessageId] = createSignal<string | null>(null);
  const [maxMessageIdWhenEntered, setMaxMessageIdWhenEntered] = createSignal<string | null>(null);
  /** Read cursor as it stood the moment we entered - frozen for the whole visit so the NEW
   * divider doesn't computationally vanish as the live cursor advances from viewport-ack
   * while still looking at it (Discord's divider stays put until you leave and come back). */
  const [lastReadMessageIdWhenEntered, setLastReadMessageIdWhenEntered] = createSignal<string | null>(null);
  const viewportAck = createViewportAck(roomId);
  /** Mirrors MessageList's own scroll-position tracking (same signal its "jump to present"
   * button uses) so the banner only shows once there's unread content actually scrolled out
   * of view - not for a couple of messages already visible at the bottom of the list. */
  const [isNearBottom, setIsNearBottom] = createSignal(true);
  let lastTypingSent = 0;

  const roomMessages = () => (roomId() ? messages.byRoom[roomId()!] ?? [] : []);
  const isLoading = () => (roomId() ? messages.loading[roomId()!] : false);
  const isSending = () => (roomId() ? messages.sending[roomId()!] : false);
  const unreadBannerInfo = () => {
    const id = roomId();
    if (!id || newHeaderDismissed.byRoom[id]) return null;
    if (isNearBottom()) return null;
    const uid = auth.user?.id;
    if (!uid) return null;
    return getUnreadBannerInfo(
      roomMessages(),
      lastReadMessageIdWhenEntered(),
      maxMessageIdWhenEntered(),
      uid,
      messages.hasMoreOlder[id] ?? false
    );
  };
  function handleMarkAsRead() {
    const id = roomId();
    if (!id) return;
    const list = roomMessages();
    if (list.length === 0) return;
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    ackRoomOptimistic(id, latest.id);
    dismissNewHeader(id);
  }
  // Load messages for a space room once, then reuse cached messages like PMs do.
  createEffect(() => {
    const id = roomId();
    if (!id) return;
    const cached = messages.byRoom[id];
    if (cached === undefined) {
      loadMessages(id);
      // Reset \"NEW messages\" header visibility when entering a channel.
      clearNewHeaderDismissed(id);
      return;
    }
    if (cached.length > 0) {
      if ((messages.scrollToBottomTick[id] ?? 0) === 0) {
        setMessages('scrollToBottomTick', id, (t) => (t ?? 0) + 1);
      }
      if (messages.hasMoreOlder[id] === undefined) {
        setMessages('hasMoreOlder', id, true);
      }
    }
  });

  // Track the max message ID that existed when we entered this channel,
  // so NEW header ignores messages that arrived while we were already viewing. Also
  // snapshot the read cursor as of THIS instant (untracked - a one-time read, not a
  // subscription) so later reactive advances to the live cursor (from this visit's own
  // viewport-ack) don't feed back into the divider/banner computation.
  //
  // Gated on auth.hydrated (tracked): hydrateFromReady populates rooms/spaceRoomsBySpaceId/
  // readState and only THEN flips this true, all synchronously in one call - but on a fresh
  // page load landing directly on a space channel, this effect's first run can land before
  // that WS round trip finishes, while readState/rooms are still empty. Since the actual
  // capture is untracked, that premature run would freeze the snapshot at null forever (no
  // unread ever looked read), showing the NEW divider on every single visit regardless of
  // real read state - this is what made it "always come back" in space channels specifically:
  // a space channel's read state only exists in these stores post-hydration, unlike the
  // room list PMs render from, which tends to already be populated by the time this runs.
  createEffect(() => {
    const id = roomId();
    const isHydrated = auth.hydrated;
    // Reset when switching channels.
    setMaxMessageIdWhenEntered(null);
    if (id) clearNewHeaderDismissed(id);
    if (!isHydrated) {
      setLastReadMessageIdWhenEntered(null);
      return;
    }
    untrack(() => {
      const r = rooms.rooms.find((x) => x.id === id);
      setLastReadMessageIdWhenEntered(id ? readState.byRoom[id]?.lastReadMessageId ?? r?.last_read_message_id ?? null : null);
    });
  });

  // Without this, the previous channel's scroll position would leak into the new one until
  // its own first scroll event, letting the banner flash on/off for a beat after switching.
  createEffect(() => {
    void roomId();
    setIsNearBottom(true);
  });

  createEffect(() => {
    const id = roomId();
    const list = roomMessages();
    const current = maxMessageIdWhenEntered();
    if (!id || list.length === 0 || current != null) return;
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const max = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    setMaxMessageIdWhenEntered(max.id);
  });

  // The viewport ack (createViewportAck) deliberately does NOT call dismissNewHeader -
  // passively scrolling past/into view shouldn't hide the NEW divider or unread banner
  // (matches Discord: those stay put for the whole visit); only sending a message or an
  // explicit Mark As Read should.

  createEffect(() => {
    const sid = spaceId();
    if (stargate.ready && sid) {
      subscribe(sid, undefined);
      onCleanup(() => unsubscribe(sid, undefined));
    }
  });

  onCleanup(() => {
    if (roomId()) clearNewHeaderDismissed(roomId()!);
  });

  // Members are fetched once per space per gateway session and kept current by
  // SPACE_MEMBER_* events, so revisiting a space renders its list from the store.
  createEffect(() => {
    const sid = spaceId();
    if (sid) {
      ensureSpaceMembers(sid).catch(() => {});
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const id = roomId();
    const raw = draft().trim();
    if (!id || (!raw && attachmentDraft.items().length === 0) || isSending()) return;
    // @username / @Role / #channel / :emoji: in the draft become <@id> / <@&id> / <#id> /
    // <:name:id> (or the Unicode emoji) for the wire.
    const text = raw ? serializeDraft(raw, mentionCatalog()) : '';
    if (auth.user?.id) removeTyping(id, auth.user.id);
    // Sending ends this typing run; the next keystroke should announce immediately
    // rather than waiting out the ping interval from before the send.
    lastTypingSent = 0;
    const files = attachmentDraft.take();
    const replyTo = replyToMessageId() ?? undefined;
    setDraft('');
    setReplyToMessageId(null);
    sendMessage(id, text, replyTo, files)
      .then(() => {
        inputRef()?.focus();
        dismissNewHeader(id);
      })
      .catch((err) => {
        console.error('Send failed:', err);
        // Give the user their message back to retry rather than silently losing it.
        setDraft(raw);
        attachmentDraft.restore(files);
        attachmentDraft.setError(err instanceof Error ? err.message : t('room.sendFailed'));
      });
  }

  function handleReplyToMessage(msg: DecryptedMessage) {
    setReplyToMessageId(msg.id);
    queueMicrotask(() => inputRef()?.focus());
  }

  function onInput(e: InputEvent) {
    const el = e.target as HTMLTextAreaElement;
    setDraft(el.value);
    setCursorPos(el.selectionStart);
    const id = roomId();
    if (id) {
      const now = Date.now();
      if (now - lastTypingSent >= TYPING_PING_MS) {
        lastTypingSent = now;
        sendTyping(id).catch(() => {});
      }
    }
  }

  // Was entirely missing - the @mention dropdown rendered and looked selectable, but
  // choosing a user did nothing at all, since RoomMessageInput's onInsertMention has no
  // default behavior of its own.
  function onInsertMention(queryStart: number, cursorEnd: number, insertText: string) {
    const before = draft().slice(0, queryStart);
    const after = draft().slice(cursorEnd);
    setDraft(before + insertText + after);
    setCursorPos(before.length + insertText.length);
    queueMicrotask(() => {
      const input = inputRef();
      if (input) {
        const pos = before.length + insertText.length;
        input.focus();
        input.setSelectionRange(pos, pos);
      }
    });
  }

  const isTextChannel = () => currentRoom()?.type === ROOM_TYPE_TEXT;
  const isVoiceChannel = () => currentRoom()?.type === ROOM_TYPE_VOICE;

  // Space text rooms get the same composer behaviour as PMs: focused on arrival, and a
  // stray keystroke anywhere on the page starts a message rather than being swallowed.
  createComposerAutoFocus({
    inputRef,
    focusKey: () => (currentRoom() && isTextChannel() ? roomId() : undefined),
    enabled: () => isTextChannel(),
    onType: appendToDraft,
  });


  /** A space text channel has a member list, so a left swipe here opens it. */
  createEffect(() => {
    setMobileMembersAvailable(isTextChannel());
  });
  onCleanup(() => {
    setMobileMembersAvailable(false);
    setMobileMembersOpen(false);
  });

  // Overrides ride on the room objects (like Discord's permission_overwrites on a
  // channel) and are patched in place by SPACE_ROOM_*OVERRIDE_* events, so switching
  // channels costs no request. `undefined` means the room arrived without them (an older
  // server payload): consumers stay permissive and the list is refreshed once.
  const roomOverridesRes = createMemo(() => {
    const r = currentRoom();
    if (!r || r.type !== ROOM_TYPE_TEXT) return undefined;
    return r.permission_overrides;
  });
  const roomUserOverridesRes = createMemo(() => {
    const r = currentRoom();
    if (!r || r.type !== ROOM_TYPE_TEXT) return undefined;
    return r.user_overrides;
  });
  const refreshedForMissingOverrides = new Set<string>();
  createEffect(() => {
    const sid = spaceId();
    const r = currentRoom();
    if (!sid || !r || r.type !== ROOM_TYPE_TEXT) return;
    if (r.permission_overrides !== undefined && r.user_overrides !== undefined) return;
    if (refreshedForMissingOverrides.has(sid)) return;
    refreshedForMissingOverrides.add(sid);
    void refreshSpaceRooms(sid).catch(() => undefined);
  });

  const visibleMembers = createMemo(() => {
    const sid = spaceId();
    const members = sid ? spaceMembers.bySpaceId[sid] ?? [] : [];
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const userOvs = roomUserOverridesRes();
    const sp = space();
    const rid = roomId();
    if (!rid || !sp || currentRoom()?.type !== ROOM_TYPE_TEXT) {
      return members;
    }
    if (roles === undefined || ovs === undefined || userOvs === undefined) {
      return members;
    }
    return members.filter((m) => {
      const mask = effectiveChannelPermissionsForMember({
        memberUserId: m.id,
        ownerId: sp.owner_id,
        everyoneRoleId: sp.everyone_role_id,
        memberRoleIds: (m as SpaceMember).roles,
        roles,
        overrides: ovs,
        userOverrides: userOvs,
      });
      if (mask === null) return true;
      return hasPerm(mask, PermViewChannel);
    });
  });

  // Declared after visibleMembers on purpose: createMemo runs its function immediately, and
  // reading a `const` memo declared further down threw "Cannot access 'visibleMembers'
  // before initialization" whenever someone happened to be typing as the channel mounted.
  const typingUsers = createMemo((): TypingPerson[] => {
    const id = roomId();
    if (!id) return [];
    return getTypingUserIds(id, auth.user?.id).map((uid) => {
      const s = getSenderDisplay(uid, visibleMembers(), auth.user?.id);
      return { id: uid, name: s.name, avatar: s.avatar };
    });
  });

  const mentionCatalog = createMemo(() =>
    buildMentionCatalog({
      participants: visibleMembers(),
      roles: spaceRolesRes(),
      channels: spaceRooms(),
      emojis: allCustomEmojis(),
    })
  );
  const replyTarget = createMemo((): ReplyTarget | null => {
    const id = replyToMessageId();
    if (!id) return null;
    const target = roomMessages().find((m) => m.id === id);
    const sender = target ? getSenderDisplay(target.sender_id, visibleMembers(), auth.user?.id) : null;
    return {
      name: sender?.name ?? t('room.replyFallback'),
      preview: target ? messagePreviewText(getMessageBodyText(target), visibleMembers(), auth.user?.id, 120) : '',
      onJump: target ? () => scrollToMessage(id) : undefined,
      onCancel: () => setReplyToMessageId(null),
    };
  });

  const canSendMessages = createMemo(() => {
    const uid = auth.user?.id;
    if (!uid || !isTextChannel()) return true;
    const sid = spaceId();
    const rid = roomId();
    const sp = space();
    if (!sid || !rid || !sp) return true;
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const userOvs = roomUserOverridesRes();
    if (roles === undefined || ovs === undefined || userOvs === undefined) return true;
    const me = spaceMembers.bySpaceId[sid]?.find((m) => m.id === uid);
    const mask = effectiveChannelPermissionsForMember({
      memberUserId: uid,
      ownerId: sp.owner_id,
      everyoneRoleId: sp.everyone_role_id,
      memberRoleIds: (me as SpaceMember | undefined)?.roles,
      roles,
      overrides: ovs,
      userOverrides: userOvs,
    });
    return canSendMessagesInChannel(mask);
  });

  /** Gates whether @everyone/@here are offered in the mention dropdown - matches the
   * backend's own PermMentionEveryone check, so the dropdown never promises a mass-notify
   * the send won't actually deliver. */
  const canMentionEveryone = createMemo(() => {
    const uid = auth.user?.id;
    if (!uid || !isTextChannel()) return false;
    const sid = spaceId();
    const rid = roomId();
    const sp = space();
    if (!sid || !rid || !sp) return false;
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const userOvs = roomUserOverridesRes();
    if (roles === undefined || ovs === undefined || userOvs === undefined) return false;
    const me = spaceMembers.bySpaceId[sid]?.find((m) => m.id === uid);
    const mask = effectiveChannelPermissionsForMember({
      memberUserId: uid,
      ownerId: sp.owner_id,
      everyoneRoleId: sp.everyone_role_id,
      memberRoleIds: (me as SpaceMember | undefined)?.roles,
      roles,
      overrides: ovs,
      userOverrides: userOvs,
    });
    return mask !== null && hasPerm(mask, PermMentionEveryone);
  });

  createEffect(() => {
    if (!canSendMessages()) setReplyToMessageId(null);
  });

  const canManageRoles = createMemo(() => {
    const sid = spaceId();
    const me = auth.user?.id;
    if (!sid || !me) return false;
    return memberCanManageRoles(
      space(),
      spaceRolesRes(),
      spaceMembers.bySpaceId[sid]?.find((m) => m.id === me) as
        | ({ roles?: string[] } & { id: string })
        | undefined,
      me
    );
  });

  const currentSpaceMember = createMemo(() => {
    const sid = spaceId();
    const me = auth.user?.id;
    if (!sid || !me) return undefined;
    return spaceMembers.bySpaceId[sid]?.find((m) => m.id === me) as
      | ({ roles?: string[] } & { id: string })
      | undefined;
  });
  const canKickMembers = createMemo(() =>
    memberCanKickMembers(space(), spaceRolesRes(), currentSpaceMember(), auth.user?.id)
  );
  const canBanMembers = createMemo(() =>
    memberCanBanMembers(space(), spaceRolesRes(), currentSpaceMember(), auth.user?.id)
  );
  /** Number.MAX_SAFE_INTEGER for the owner - no ceiling, can moderate anyone. */
  const viewerHighestRolePosition = createMemo(() => {
    const me = auth.user?.id;
    if (!me) return -1;
    if (space()?.owner_id === me) return Number.MAX_SAFE_INTEGER;
    return memberHighestRolePosition(space()?.everyone_role_id, spaceRolesRes(), currentSpaceMember());
  });

  async function handleKickMember(userId: string) {
    const sid = spaceId();
    if (!sid) return;
    const ok = await confirmDialog({
      title: t('room.members.kick'),
      body: t('space.kickConfirm'),
      confirmLabel: t('room.members.kick'),
      tone: 'danger',
      icon: 'fa-solid fa-user-minus',
    });
    if (!ok) return;
    try {
      await kickSpaceMember(sid, userId);
    } catch (err) {
      console.error('Failed to kick member:', err);
    }
  }

  async function handleBanMember(userId: string) {
    const sid = spaceId();
    if (!sid) return;
    const ok = await confirmDialog({
      title: t('room.members.ban'),
      body: t('space.banConfirm'),
      confirmLabel: t('room.members.ban'),
      tone: 'danger',
      icon: 'fa-solid fa-ban',
    });
    if (!ok) return;
    try {
      await banSpaceMember(sid, userId);
    } catch (err) {
      console.error('Failed to ban member:', err);
    }
  }

  /** If we're kicked/banned/leave (locally or from another session), the space disappears
   * from the store - bounce back home instead of showing a dead page. */
  createEffect(() => {
    const sid = spaceId();
    if (!sid || !spaces.hydrated) return;
    if (!space()) navigate('/', { replace: true });
  });

  const canManageMessagesInRoom = createMemo(() => {
    const uid = auth.user?.id;
    if (!uid || !isTextChannel()) return true;
    const sid = spaceId();
    const rid = roomId();
    const sp = space();
    if (!sid || !rid || !sp) return true;
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const userOvs = roomUserOverridesRes();
    if (roles === undefined || ovs === undefined || userOvs === undefined) return true;
    const me = spaceMembers.bySpaceId[sid]?.find((m) => m.id === uid);
    const mask = effectiveChannelPermissionsForMember({
      memberUserId: uid,
      ownerId: sp.owner_id,
      everyoneRoleId: sp.everyone_role_id,
      memberRoleIds: (me as SpaceMember | undefined)?.roles,
      roles,
      overrides: ovs,
      userOverrides: userOvs,
    });
    if (mask === null) return true;
    return hasPerm(mask, PermManageMessages);
  });

  /** Gates the reaction-add button/pills/context-menu entry - matches the backend's
   * PermAddReactions check on PUT .../reactions/:emoji, including per-room overrides. */
  const canReact = createMemo(() => {
    const uid = auth.user?.id;
    if (!uid || !isTextChannel()) return true;
    const sid = spaceId();
    const rid = roomId();
    const sp = space();
    if (!sid || !rid || !sp) return true;
    const roles = spaceRolesRes();
    const ovs = roomOverridesRes();
    const userOvs = roomUserOverridesRes();
    if (roles === undefined || ovs === undefined || userOvs === undefined) return true;
    const me = spaceMembers.bySpaceId[sid]?.find((m) => m.id === uid);
    const mask = effectiveChannelPermissionsForMember({
      memberUserId: uid,
      ownerId: sp.owner_id,
      everyoneRoleId: sp.everyone_role_id,
      memberRoleIds: (me as SpaceMember | undefined)?.roles,
      roles,
      overrides: ovs,
      userOverrides: userOvs,
    });
    if (mask === null) return true;
    return hasPerm(mask, PermAddReactions);
  });

  const pinnedIdsForRoom = createMemo(() => {
    const id = roomId();
    if (!id) return [] as string[];
    return pinnedMessages.byRoom[id] ?? [];
  });

  const pinnedMessagesForRoom = createMemo(() => {
    const ids = new Set(pinnedIdsForRoom());
    if (ids.size === 0) return [] as DecryptedMessage[];
    const list = roomMessages();
    const found: DecryptedMessage[] = [];
    for (const m of list) {
      if (ids.has(m.id)) found.push(m);
    }
    found.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return found;
  });

  const headerName = createMemo(() => {
    if (currentRoom()) return currentRoom()!.name || t('space.defaultRoom');
    return space()?.name || t('space.fallbackName', { id: spaceId() });
  });

  /** Text channels of this space, for the search box's `in:` filter and for labelling
   * which channel a result came from. */
  const searchChannels = createMemo(() =>
    spaceRooms()
      .filter((r) => r.type === ROOM_TYPE_TEXT)
      .map((r) => ({ id: r.id, name: r.name }))
  );

  function handleSearchSubmit(raw: string) {
    setSearchQuery(raw);
    if (!raw) {
      setSearchOpen(false);
      return;
    }
    setSearchOpen(true);
    setPinnedOpen(false);
  }

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchDraft('');
    setSearchQuery('');
  }

  function handleTogglePinned() {
    const next = !pinnedOpen();
    setPinnedOpen(next);
    if (next) setSearchOpen(false);
  }

  /** A hit in another channel has to get there first; its history then loads before the
   * row exists to scroll to. */
  function handleSelectSearchedMessage(messageId: string, hitRoomId: string) {
    if (hitRoomId && hitRoomId !== roomId()) {
      navigate(`/spaces/${spaceId()}/rooms/${hitRoomId}`);
      scrollToMessageWhenReady(messageId);
      return;
    }
    scrollToMessage(messageId);
  }

  function handleSelectPinnedMessage(messageId: string) {
    scrollToMessage(messageId);
  }

  return (
    <div class="flex-1 flex flex-col min-h-0">
      <Show
        when={roomId() && isTextChannel() && currentRoom()}
        fallback={
          <div class={`${appPageHeader} justify-between gap-3`}>
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <MobileRailsOpenButton />
              <h1 class={`min-w-0 truncate ${appPageTitle}`}>{headerName()}</h1>
            </div>
          </div>
        }
      >
        <RoomHeader
          headerIcon="fa-hashtag"
          name={headerName()}
          pmOtherUserId={undefined}
          e2ee={currentRoom()?.e2ee_enabled === true}
          isGroup={false}
          messageCompact={!!settings.messageCompact}
          onToggleCompact={() => {}}
          hasPinned={pinnedMessagesForRoom().length > 0}
          pinnedOpen={pinnedOpen()}
          onTogglePinned={handleTogglePinned}
          searchQuery={searchDraft()}
          onSearchQueryChange={setSearchDraft}
          onSearchSubmit={handleSearchSubmit}
          searchPeople={visibleMembers()}
          searchChannels={searchChannels()}
          showMembersToggle
          membersPanelOpen={!!(settings as SettingsData).membersPanelOpen}
          onToggleMembers={() => setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)}
          onAddPeople={() => {}}
          notifyMode={currentRoom()?.notify_mode ?? 0}
          muted={isRoomMuted(currentRoom())}
          onSetNotifyMode={(mode) => {
            const rid = roomId();
            if (rid) void setRoomNotifyMode(rid, mode).catch((err) => console.error('Set notify mode failed:', err));
          }}
          onMute={(ms) => {
            const rid = roomId();
            if (rid) void muteRoom(rid, ms).catch((err) => console.error('Mute room failed:', err));
          }}
          onUnmute={() => {
            const rid = roomId();
            if (rid) void unmuteRoom(rid).catch((err) => console.error('Unmute room failed:', err));
          }}
        />
        <UnreadBanner info={unreadBannerInfo()} onMarkAsRead={handleMarkAsRead} />
      </Show>

      {/* Content: space overview when no room, text channel when room is text, voice placeholder when voice */}
      <Show when={!roomId()}>
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <p class="text-muted-foreground">{t('space.selectRoom')}</p>
        </div>
      </Show>

      <Show when={roomId() && isVoiceChannel()}>
        <Show
          when={instance.voiceEnabled}
          fallback={
            <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <p class="text-muted-foreground">{t('space.voiceUnsupported')}</p>
            </div>
          }
        >
          <div class="flex-1 flex min-h-0 flex-col">
            <div class="flex h-9 shrink-0 items-center gap-2 px-4 text-xs text-muted-foreground">
              <i class="fa-solid fa-volume-high" aria-hidden="true" />
              <span>
                {t('voice.participants', { count: voiceStatesForRoom(roomId()!).length })}
                <Show when={(currentRoom()?.user_limit ?? 0) > 0}> · {t('voice.limit', { count: voiceStatesForRoom(roomId()!).length, limit: currentRoom()!.user_limit })}</Show>
              </span>
            </div>
            <VoiceStage
              roomId={roomId()!}
              spaceId={spaceId()!}
              roomName={currentRoom()?.name || t('space.defaultRoom')}
              kind="space"
              layout="page"
            />
          </div>
        </Show>
      </Show>

      <Show when={roomId() && isTextChannel() && currentRoom() && pinnedOpen()}>
        <div class={`fixed md:absolute top-14 end-4 ${zLayer.drawer}`}>
          <RoomPinnedPanel
            roomId={roomId()!}
            messages={pinnedMessagesForRoom()}
            participants={visibleMembers()}
            spaceRoles={spaceRolesRes()}
            onSelectMessage={handleSelectPinnedMessage}
          />
        </div>
      </Show>

      <Show when={roomId() && isTextChannel()}>
        <div class="relative flex-1 flex min-h-0 overflow-hidden">
          <Show when={!currentRoom()}>
            <div class="flex-1 flex items-center justify-center p-8 text-muted-foreground">{t('space.loadingRoom')}</div>
          </Show>
          <Show when={currentRoom()}>
            {/* The composer floats over the list, so this is its positioning context and
                carries the measured bar height for the list's bottom padding. */}
            <div
              class="relative flex-1 flex flex-col min-h-0 min-w-0"
              style={{ '--composer-height': `${composerHeight()}px` }}
            >
              <Show when={!isLoading()} fallback={<MessageSkeleton />}>
                <MessageList
                  messages={roomMessages()}
                  roomId={roomId()!}
                  roomType={ROOM_TYPE_TEXT}
                  roomName={currentRoom()!.name}
                  e2eeEnabled={currentRoom()!.e2ee_enabled === true}
                  participants={visibleMembers()}
                  spaceRoles={spaceRolesRes()}
                  spaceId={spaceId()!}
                  spaceOwnerId={space()?.owner_id ?? ''}
                  canManageMemberRoles={canManageRoles()}
                  onSpaceMemberRolesUpdated={() => {
                    const sid = spaceId();
                    if (sid) loadSpaceMembers(sid).catch(() => {});
                  }}
                  onMessageUser={(userId) => {
                    createPM(userId)
                      .then((r) => navigate(`/rooms/${r.id}`))
                      .catch((err) => console.error('Failed to open DM:', err));
                  }}
                  loadingOlder={messages.loadingOlder[roomId()!]}
                  hasMoreOlder={messages.hasMoreOlder[roomId()!]}
                  onLoadOlder={(getScroll) => loadOlderMessages(roomId()!, getScroll)}
                  lastReadMessageId={lastReadMessageIdWhenEntered()}
                  maxMessageIdWhenEntered={maxMessageIdWhenEntered()}
                  onReply={handleReplyToMessage}
                  canReply={canSendMessages()}
                  canManageMessages={canManageMessagesInRoom()}
                  canReact={canReact()}
                onBottomVisibleMessageChange={viewportAck.setBottomVisibleMessageId}
                onNearBottomChange={setIsNearBottom}
                />
              </Show>
              <RoomComposerDock onHeightChange={setComposerHeight}>
              <RoomMessageInput
                draft={draft()}
                onInput={onInput}
                onSubmit={handleSubmit}
                placeholder={t('room.messageSpaceRoom', { name: currentRoom()!.name || t('space.defaultRoom') })}
                disabled={isSending() || !canSendMessages()}
                inputRef={setInputRef}
                typingUsers={typingUsers()}
                participants={visibleMembers()}
                spaceRoles={spaceRolesRes()}
                spaceRooms={spaceRooms()}
                canMentionEveryone={canMentionEveryone()}
                currentUserId={auth.user?.id}
                cursorPos={cursorPos()}
                onInsertMention={onInsertMention}
                onCursorChange={setCursorPos}
                mentionCatalog={mentionCatalog()}
                replyTo={canSendMessages() ? replyTarget() : null}
                attachments={attachmentDraft.items()}
                onAddFiles={(files) => void attachmentDraft.addFiles(files)}
                onRemoveAttachment={attachmentDraft.remove}
                attachmentError={attachmentDraft.error()}
                customEmojis={allCustomEmojis()}
                noSendMessage={canSendMessages() ? undefined : t('space.noSendPermission')}
              />
              </RoomComposerDock>
            </div>
            {/* Tapping the chat closes the swiped-in member drawer, the way any drawer
                dismisses on an outside tap. */}
            <Show when={!isMdViewport() && mobileMembersOpen()}>
              <button
                type="button"
                class="absolute inset-0 z-20 bg-black/40 md:hidden"
                aria-label={t('room.hideMembers')}
                onClick={() => setMobileMembersOpen(false)}
              />
            </Show>
            <Show
              when={
                isMdViewport()
                  ? (settings as SettingsData).membersPanelOpen || searchOpen()
                  : isTextChannel()
              }
            >
              <Show
                when={isMdViewport() && searchOpen()}
                fallback={
                  <RoomMembersSidebar
                    mobileOpen={mobileMembersOpen()}
                    participants={visibleMembers()}
                    currentUserId={auth.user?.id}
                    onMessageUser={(userId) => {
                      createPM(userId)
                        .then((r) => navigate(`/rooms/${r.id}`))
                        .catch((err) => console.error('Failed to open DM:', err));
                    }}
                    creatorId={space()?.owner_id}
                    spaceRoles={spaceRolesRes()}
                    spaceId={spaceId()!}
                    spaceOwnerId={space()?.owner_id ?? ''}
                    canManageMemberRoles={canManageRoles()}
                    onSpaceMemberRolesUpdated={() => {
                      const sid = spaceId();
                      if (sid) loadSpaceMembers(sid).catch(() => {});
                    }}
                    canKickMembers={canKickMembers()}
                    canBanMembers={canBanMembers()}
                    viewerHighestRolePosition={viewerHighestRolePosition()}
                    onKickMember={handleKickMember}
                    onBanMember={handleBanMember}
                    showMembersHeader={false}
                    listAriaLabel={t('space.membersAria')}
                  />
                }
              >
                <RoomSearchPanel
                  spaceId={spaceId()}
                  roomId={roomId()!}
                  query={searchQuery()}
                  participants={visibleMembers()}
                  channels={searchChannels()}
                  spaceRoles={spaceRolesRes()}
                  roomE2EE={currentRoom()?.e2ee_enabled === true}
                  onClose={handleCloseSearch}
                  onSelectMessage={handleSelectSearchedMessage}
                />
              </Show>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default SpacePage;
