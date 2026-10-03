import type { Component } from 'solid-js';
import { createSignal, createEffect, createMemo, Show, onMount, onCleanup, untrack } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { roomDisplayName, addOrUpdateRoom, removeRoom } from '../stores/rooms';
import { rooms, isNotesRoom } from '../stores/rooms';
import { auth } from '../stores/auth';
import {
  messages,
  setMessages,
  loadMessages,
  loadOlderMessages,
  loadNewerMessages,
  jumpToPresent,
  jumpToMessage,
  hasPendingJump,
  sendMessage,
  type DecryptedMessage,
} from '../stores/messages';
import { getTypingUserIds, removeTyping } from '../stores/typing';
import { sendTyping, createPM, getRoom, removeRoomParticipant, updateRoom } from '../api/rooms';
import { subscribe, unsubscribe, onStargateEvent } from '../services/stargate/client';
import { MessageList } from '../components/MessageListView';
import { MessageSkeleton } from '../components/MessageSkeleton';
import { AddPeopleModal } from '../components/AddPeopleModal';
import {
  RoomComposerDock,
  RoomHeader,
  RoomMessageInput,
  RoomMembersSidebar,
  RoomSearchPanel,
  RoomPinnedPanel,
  RenameGroupModal,
  UnreadBanner,
} from '../components/room';
import { settings, setMessageCompact, setMembersPanelOpen } from '../stores/settings';
import type { SettingsData } from '../stores/settings';
import { stargate } from '../stores/stargate';
import { messageIdGt, readState, ackRoomOptimistic, getUnreadBannerInfo } from '../stores/readState';
import { createViewportAck } from '../lib/viewportAck';
import { dismissNewHeader, clearNewHeaderDismissed, newHeaderDismissed } from '../stores/newHeaderDismissed';
import { getMessageBodyText, getSenderDisplay, messagePreviewText } from '../components/messageList';
import { buildMentionCatalog, serializeDraft } from '../lib/utils/mentions';
import type { ReplyTarget, TypingPerson } from '../components/room';
import { createComposerAutoFocus } from '../lib/composerFocus';
import { scrollToMessage } from '../lib/utils/messages';
import { pinnedMessages } from '../stores/pinnedMessages';
import { createAttachmentDraft } from '../lib/attachments/draft';
import { allCustomEmojis } from '../stores/customEmojis';
import { isRoomMuted, muteRoom, setRoomNotifyMode, unmuteRoom } from '../lib/roomNotify';
import {
  isMdViewport,
  mobileMembersOpen,
  setMobileMembersAvailable,
  setMobileMembersOpen,
} from '../stores/mobileShellLayout';
import { zLayer } from '../theme/appChrome';
import { instance } from '../stores/instance';
import { isConnectedTo, joinVoiceRoom, voice, voiceStatesForRoom } from '../stores/voice';
import { VoiceStage } from '../components/voice/VoiceStage';
import { t } from '../i18n';

/** How often we re-announce "still typing" while the user keeps going. Must sit above
 * the server's 5s per-user rate limit (announcements inside it are dropped) and below
 * the client's 10s TTL, so a continuous typist never flickers out. */
const TYPING_PING_MS = 6000;

const RoomPage: Component = () => {
  const params = useParams<{ roomId: string }>();
  const navigate = useNavigate();
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
  const [maxMessageIdWhenEntered, setMaxMessageIdWhenEntered] = createSignal<string | null>(null);
  /** Read cursor as it stood the moment we entered - frozen for the whole visit so the NEW
   * divider doesn't computationally vanish as the live cursor advances from viewport-ack
   * while still looking at it (Discord's divider stays put until you leave and come back). */
  const [lastReadMessageIdWhenEntered, setLastReadMessageIdWhenEntered] = createSignal<string | null>(null);
  /** Mirrors MessageList's own scroll-position tracking (same signal its "jump to present"
   * button uses) so the banner only shows once there's unread content actually scrolled out
   * of view - not for a couple of messages already visible at the bottom of the list. */
  const [isNearBottom, setIsNearBottom] = createSignal(true);
  const [showAddPeople, setShowAddPeople] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);
  /** Raw text in the header search box vs. the query the results panel is showing - typing
   * doesn't re-run the search until Enter. */
  const [searchDraft, setSearchDraft] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [pinnedOpen, setPinnedOpen] = createSignal(false);
  /** Measured height of the floating composer; the list pads itself by this much. */
  const [composerHeight, setComposerHeight] = createSignal(0);
  const [renameModalOpen, setRenameModalOpen] = createSignal(false);
  const [replyToMessageId, setReplyToMessageId] = createSignal<string | null>(null);
  const viewportAck = createViewportAck(() => params.roomId);
  let lastTypingSent = 0;
  const room = () => rooms.rooms.find((r) => r.id === params.roomId);
  const pmOtherUserId = createMemo(() => {
    const r = room();
    if (r?.type !== 1 || !auth.user?.id) return undefined;
    return r.participants?.find((p) => p.id !== auth.user?.id)?.id;
  });
  const name = () => {
    const r = room();
    return r && auth.user?.id ? roomDisplayName(r, auth.user.id) : t('room.conversation');
  };
  const headerIcon = () => {
    const r = room();
    if (!r || !auth.user?.id) return 'fa-message';
    if (isNotesRoom(r, auth.user.id)) return 'fa-note-sticky';
    if (r.type === 2) return 'fa-user-group';
    return 'fa-message';
  };
  /** Placeholder: "Message @user" for PMs, "Message [room name]" for others */
  const inputPlaceholder = () => {
    const r = room();
    if (!r || !auth.user?.id) return t('room.messagePlaceholder');
    const displayName = roomDisplayName(r, auth.user.id);
    return r.type === 1 ? t('room.messageUser', { name: displayName }) : t('room.messageRoom', { name: displayName });
  };
  const roomMessages = () => messages.byRoom[params.roomId] ?? [];
  const isGroupRoom = () => room()?.type === 2;
  /** Calls exist in PMs and group PMs (never in the notes room) when the instance has voice. */
  const canCall = () => {
    const r = room();
    return instance.voiceEnabled && !!r && (r.type === 1 || r.type === 2) && !!auth.user?.id && !isNotesRoom(r, auth.user.id);
  };
  const callActive = () => !!voice.calls[params.roomId] || voiceStatesForRoom(params.roomId).length > 0;
  /** The call view shows while a call runs here or we are connected to it. */
  const showCallStage = () => canCall() && (callActive() || isConnectedTo(params.roomId));
  function startCall(video: boolean) {
    if (isConnectedTo(params.roomId)) return;
    void joinVoiceRoom(params.roomId, { video }).catch((err) => console.error('Start call failed:', err));
  }

  /** Only a group PM has a member list, so only there does a left swipe open one. */
  createEffect(() => {
    setMobileMembersAvailable(isGroupRoom());
  });
  onCleanup(() => {
    setMobileMembersAvailable(false);
    setMobileMembersOpen(false);
  });
  const mentionCatalog = createMemo(() =>
    buildMentionCatalog({ participants: room()?.participants, emojis: allCustomEmojis() })
  );
  const replyTarget = createMemo((): ReplyTarget | null => {
    const id = replyToMessageId();
    if (!id) return null;
    const target = roomMessages().find((m) => m.id === id);
    const sender = target ? getSenderDisplay(target.sender_id, room()?.participants ?? [], auth.user?.id) : null;
    return {
      name: sender?.name ?? t('room.replyFallback'),
      preview: target ? messagePreviewText(getMessageBodyText(target), room()?.participants, auth.user?.id, 120) : '',
      onJump: target ? () => scrollToMessage(id) : undefined,
      onCancel: () => setReplyToMessageId(null),
    };
  });
  const unreadBannerInfo = () => {
    if (newHeaderDismissed.byRoom[params.roomId]) return null;
    if (isNearBottom()) return null;
    const uid = auth.user?.id;
    if (!uid) return null;
    return getUnreadBannerInfo(
      roomMessages(),
      lastReadMessageIdWhenEntered(),
      maxMessageIdWhenEntered(),
      uid,
      messages.hasMoreOlder[params.roomId] ?? false
    );
  };
  function handleMarkAsRead() {
    const roomId = params.roomId;
    const list = roomMessages();
    if (list.length === 0) return;
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    ackRoomOptimistic(roomId, latest.id);
    dismissNewHeader(roomId);
  }
  const typingUsers = createMemo((): TypingPerson[] =>
    getTypingUserIds(params.roomId, auth.user?.id).map((uid) => {
      const s = getSenderDisplay(uid, room()?.participants, auth.user?.id);
      return { id: uid, name: s.name, avatar: s.avatar };
    })
  );

  const pinnedIdsForRoom = createMemo(() => {
    const roomId = params.roomId;
    if (!roomId) return [] as string[];
    return pinnedMessages.byRoom[roomId] ?? [];
  });

  const pinnedMessagesForRoom = createMemo(() => {
    const ids = new Set(pinnedIdsForRoom());
    if (ids.size === 0) return [] as DecryptedMessage[];
    const list: DecryptedMessage[] = roomMessages();
    const found: DecryptedMessage[] = [];
    for (const m of list) {
      if (ids.has(m.id)) found.push(m);
    }
    found.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return found;
  });

  function onInput(e: InputEvent) {
    const el = e.target as HTMLTextAreaElement;
    setDraft(el.value);
    setCursorPos(el.selectionStart);
    const now = Date.now();
    if (now - lastTypingSent >= TYPING_PING_MS) {
      lastTypingSent = now;
      sendTyping(params.roomId).catch(() => {});
    }
  }

  function onInsertMention(queryStart: number, cursorEnd: number, insertText: string) {
    const before = draft().slice(0, queryStart);
    const after = draft().slice(cursorEnd);
    const insert = insertText;
    setDraft(before + insert + after);
    setCursorPos(before.length + insert.length);
    queueMicrotask(() => {
      const input = inputRef();
      if (input) {
        const pos = before.length + insert.length;
        input.focus();
        input.setSelectionRange(pos, pos);
      }
    });
  }
  const isLoading = () => messages.loading[params.roomId] ?? false;
  const isSending = () => messages.sending[params.roomId] ?? false;

  createEffect(() => {
    const roomId = params.roomId;
    if (!roomId) return;
    const cached = messages.byRoom[roomId];
    if (cached === undefined) {
      // A jump to a specific message (reply/search) is loading a window around it; don't also
      // fire the normal tail-load - it would race the around-load and drop us at the bottom.
      if (hasPendingJump(roomId)) return;
      loadMessages(roomId);
      return;
    }
    // Entering a cached room: the list lands itself (saved spot, unread divider or the
    // bottom) when the room changes under it, so there is nothing to trigger here.
    if (cached.length > 0 && messages.hasMoreOlder[roomId] === undefined) {
      setMessages('hasMoreOlder', roomId, true);
    }
  });

  // Reset maxMessageIdWhenEntered when switching rooms; set when messages first load.
  // Also snapshot the read cursor as of THIS instant (untracked - a one-time read, not a
  // subscription) so later reactive advances to the live cursor (from this visit's own
  // viewport-ack) don't feed back into the divider computation.
  //
  // Gated on auth.hydrated (tracked): hydrateFromReady populates rooms/readState and only
  // THEN flips this true, all synchronously in one call - but on a fresh page load this
  // effect's first run can land before that WS round trip finishes, while both stores are
  // still empty. Since the actual capture is untracked, that premature run would freeze the
  // snapshot at null forever (no unread ever looked read), showing the NEW divider on every
  // single visit regardless of real read state. Waiting for hydrated lets the effect re-run
  // once real data exists, instead of only ever seeing the pre-hydration snapshot.
  createEffect(() => {
    const roomId = params.roomId;
    const isHydrated = auth.hydrated;
    setMaxMessageIdWhenEntered(null);
    if (!isHydrated) {
      setLastReadMessageIdWhenEntered(null);
      return;
    }
    untrack(() => {
      const r = rooms.rooms.find((x) => x.id === roomId);
      setLastReadMessageIdWhenEntered(readState.byRoom[roomId]?.lastReadMessageId ?? r?.last_read_message_id ?? null);
    });
  });

  // Without this, the previous room's scroll position would leak into the new room until
  // its own first scroll event, letting the banner flash on/off for a beat after switching.
  createEffect(() => {
    void params.roomId;
    setIsNearBottom(true);
  });
  createEffect(() => {
    const roomId = params.roomId;
    const list = roomMessages();
    const current = maxMessageIdWhenEntered();
    if (!roomId || list.length === 0 || current != null) return;
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const max = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    setMaxMessageIdWhenEntered(max.id);
  });

  // Ensure participants are loaded for current room (e.g. PMs may not have them in listRooms)
  createEffect(() => {
    const roomId = params.roomId;
    const r = room();
    if (!roomId || !r) return;
    const participants = r.participants ?? [];
    if (participants.length > 0) return;
    getRoom(roomId).then((full) => addOrUpdateRoom(full)).catch(() => {});
  });

  // Subscribe to room when Stargate is ready (WS may not be open on mount)
  createEffect(() => {
    const roomId = params.roomId;
    if (stargate.ready && roomId) {
      subscribe(roomId, undefined);
      onCleanup(() => unsubscribe(roomId, undefined));
    }
  });

  createComposerAutoFocus({
    inputRef,
    focusKey: () => (room() ? params.roomId : undefined),
    onType: appendToDraft,
  });

  onCleanup(() => {
    clearNewHeaderDismissed(params.roomId);
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const raw = draft().trim();
    if ((!raw && attachmentDraft.items().length === 0) || isSending()) return;
    // @username / :emoji: in the draft become <@id> / <:name:id> (or the Unicode emoji).
    const text = raw ? serializeDraft(raw, mentionCatalog()) : '';
    if (auth.user?.id) removeTyping(params.roomId, auth.user.id);
    // Sending ends this typing run; the next keystroke should announce immediately.
    lastTypingSent = 0;
    const files = attachmentDraft.take();
    const replyTo = replyToMessageId() ?? undefined;
    setDraft('');
    setReplyToMessageId(null);
    // Refocus synchronously, inside the send gesture, so the mobile on-screen keyboard doesn't
    // close and pop back: a focus() after `await sendMessage` lands outside the gesture (a
    // network round-trip later), which some mobile browsers answer by hiding then re-showing
    // the keyboard. Kept for the Enter-key path; the send button also preventDefaults pointerdown.
    inputRef()?.focus();
    try {
      await sendMessage(params.roomId, text, replyTo, files);
      dismissNewHeader(params.roomId);
    } catch (err) {
      console.error('Send failed:', err);
      // Give the user their message back to retry rather than silently losing it.
      setDraft(raw);
      attachmentDraft.restore(files);
      attachmentDraft.setError(err instanceof Error ? err.message : t('room.sendFailed'));
    }
  }

  /** Send a GIF picked from the composer's GIF tab: its direct .gif URL becomes the message,
   * which the renderer shows inline (see MessageBody / isGifUrl). */
  async function handleSendGif(url: string) {
    if (isSending()) return;
    try {
      await sendMessage(params.roomId, url);
      dismissNewHeader(params.roomId);
    } catch (err) {
      console.error('Send GIF failed:', err);
    }
  }

  function handleSelectSearchedMessage(messageId: string) {
    void jumpToMessage(params.roomId, messageId);
  }

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

  function handleSelectPinnedMessage(messageId: string) {
    void jumpToMessage(params.roomId, messageId);
  }

  function handleTogglePinned() {
    const next = !pinnedOpen();
    setPinnedOpen(next);
    if (next) {
      setSearchOpen(false);
    }
  }

  function handleReplyToMessage(msg: DecryptedMessage) {
    setReplyToMessageId(msg.id);
    queueMicrotask(() => inputRef()?.focus());
  }

  async function handleRemoveMember(userId: string) {
    try {
      await removeRoomParticipant(params.roomId, userId);
      const updated = await getRoom(params.roomId);
      addOrUpdateRoom(updated);
    } catch (err) {
      console.error('Remove member failed:', err);
    }
  }

  async function handleGroupSettings(opts: { name: string; e2ee_enabled: boolean }) {
    const updated = await updateRoom(params.roomId, { name: opts.name, e2ee_enabled: opts.e2ee_enabled });
    addOrUpdateRoom(updated);
  }

  onMount(() => {
    const unsub = onStargateEvent((evt) => {
      if (evt.t !== 'ROOM_LEAVE') return;
      const payload = (evt.d as { d?: { room_id?: string } })?.d ?? evt.d;
      const roomId = payload && typeof payload === 'object' && 'room_id' in payload ? String(payload.room_id) : null;
      if (roomId === params.roomId) {
        removeRoom(roomId);
        navigate('/');
      }
    });
    onCleanup(unsub);
  });

  return (
    <div class="flex-1 flex flex-col min-h-0">
      <RoomHeader
        headerIcon={headerIcon()}
        name={name()}
        bot={room()?.type === 1 && room()?.participants?.some((p) => p.id === pmOtherUserId() && p.bot === true)}
        pmOtherUserId={pmOtherUserId()}
        e2ee={room()?.type === 1 || (room()?.type === 2 && room()?.e2ee_enabled !== false)}
        isGroup={room()?.type === 2}
        messageCompact={!!settings.messageCompact}
        onToggleCompact={() => setMessageCompact(!settings.messageCompact)}
        hasPinned={pinnedMessagesForRoom().length > 0}
        pinnedOpen={pinnedOpen()}
        onTogglePinned={handleTogglePinned}
        searchQuery={searchDraft()}
        onSearchQueryChange={setSearchDraft}
        onSearchSubmit={handleSearchSubmit}
        searchPeople={room()?.participants}
        membersPanelOpen={isMdViewport() ? !!(settings as SettingsData).membersPanelOpen : mobileMembersOpen()}
        onToggleMembers={() =>
          isMdViewport()
            ? setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)
            : setMobileMembersOpen(!mobileMembersOpen())
        }
        onAddPeople={() => setShowAddPeople(true)}
        isCreator={room()?.type === 2 && !!room()?.creator_id && room()?.creator_id !== '0' && room()?.creator_id === auth.user?.id}
        onOpenSettings={() => setRenameModalOpen(true)}
        notifyMode={room()?.notify_mode ?? 0}
        muted={isRoomMuted(room())}
        onSetNotifyMode={(mode) => void setRoomNotifyMode(params.roomId, mode).catch((err) => console.error('Set notify mode failed:', err))}
        onMute={(ms) => void muteRoom(params.roomId, ms).catch((err) => console.error('Mute room failed:', err))}
        onUnmute={() => void unmuteRoom(params.roomId).catch((err) => console.error('Unmute room failed:', err))}
        onStartCall={canCall() ? startCall : undefined}
        callActive={callActive()}
      />
      <Show when={showCallStage()}>
        <div class="h-[42%] min-h-[240px] shrink-0 border-b border-border">
          <VoiceStage
            roomId={params.roomId}
            participants={room()?.participants ?? []}
            roomName={name()}
            kind="call"
            layout="panel"
          />
        </div>
      </Show>
      <UnreadBanner info={unreadBannerInfo()} onMarkAsRead={handleMarkAsRead} />
      <RenameGroupModal
        open={renameModalOpen()}
        currentName={room()?.name ?? ''}
        currentE2eeEnabled={room()?.e2ee_enabled}
        onSave={handleGroupSettings}
        onClose={() => setRenameModalOpen(false)}
      />
      <AddPeopleModal
        open={showAddPeople()}
        roomId={params.roomId}
        participantIds={room()?.participants?.map((p) => p.id) ?? []}
        onClose={() => setShowAddPeople(false)}
      />
      <Show when={pinnedOpen()}>
        <div class={`fixed md:absolute top-14 end-4 ${zLayer.drawer}`}>
          <RoomPinnedPanel
            roomId={params.roomId}
            messages={pinnedMessagesForRoom()}
            participants={room()?.participants ?? []}
            onSelectMessage={handleSelectPinnedMessage}
          />
        </div>
      </Show>
      <div class="relative flex-1 flex min-h-0 overflow-hidden">
        {/* Positioning context for the floating composer; see RoomComposerDock. */}
        <div
          class="relative flex-1 flex flex-col min-h-0 min-w-0"
          style={{ '--composer-height': `${composerHeight()}px` }}
        >
          <Show when={!room()}>
            <div class="flex-1 flex items-center justify-center p-8 text-muted-foreground">
              <p>{t('room.notFound')}</p>
            </div>
          </Show>
          <Show when={room()}>
            <Show when={isLoading()} fallback={
              <MessageList
                messages={roomMessages()}
                roomId={params.roomId}
                roomType={room()?.type}
                roomName={room()?.name}
                participants={room()?.participants}
                e2eeEnabled={room()?.e2ee_enabled}
                onMessageUser={(userId) => {
                  createPM(userId)
                    .then((r) => navigate(`/rooms/${r.id}`))
                    .catch((err) => console.error(err));
                }}
                hasMoreOlder={messages.hasMoreOlder[params.roomId]}
                onLoadOlder={(getScroll) => loadOlderMessages(params.roomId, getScroll)}
                hasMoreNewer={messages.hasMoreNewer[params.roomId]}
                onLoadNewer={(getScroll) => void loadNewerMessages(params.roomId, getScroll)}
                onJumpToPresent={() => void jumpToPresent(params.roomId)}
                lastReadMessageId={lastReadMessageIdWhenEntered()}
                maxMessageIdWhenEntered={maxMessageIdWhenEntered()}
                onReply={handleReplyToMessage}
                onBottomVisibleMessageChange={viewportAck.setBottomVisibleMessageId}
                onNearBottomChange={setIsNearBottom}
              />
            }>
              <MessageSkeleton />
            </Show>
            <RoomComposerDock onHeightChange={setComposerHeight}>
            <RoomMessageInput
              draft={draft()}
              onInput={onInput}
              onSubmit={handleSubmit}
              placeholder={inputPlaceholder()}
              disabled={false}
              sending={isSending()}
              inputRef={setInputRef}
              typingUsers={typingUsers()}
              participants={room()?.participants}
              currentUserId={auth.user?.id}
              canMentionEveryone={isGroupRoom()}
              cursorPos={cursorPos()}
              onInsertMention={onInsertMention}
              onCursorChange={setCursorPos}
              mentionCatalog={mentionCatalog()}
              replyTo={replyTarget()}
              attachments={attachmentDraft.items()}
              onAddFiles={(files) => void attachmentDraft.addFiles(files)}
              onRemoveAttachment={attachmentDraft.remove}
              attachmentError={attachmentDraft.error()}
              customEmojis={allCustomEmojis()}
              onSendGif={handleSendGif}
            />
            </RoomComposerDock>
          </Show>
        </div>
        {/* Tapping the chat closes the swiped-in member drawer. */}
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
            room() &&
            (isMdViewport()
              ? isGroupRoom()
                ? (settings as SettingsData).membersPanelOpen || searchOpen()
                : searchOpen()
              : isGroupRoom())
          }
        >
          <Show
            when={isMdViewport() && searchOpen()}
            fallback={
              <Show when={isGroupRoom()}>
                <RoomMembersSidebar
                  mobileOpen={mobileMembersOpen()}
                  participants={room()!.participants ?? []}
                  currentUserId={auth.user?.id}
                  onMessageUser={(userId) => {
                    createPM(userId).then((r) => navigate(`/rooms/${r.id}`)).catch((err) => console.error(err));
                  }}
                  creatorId={room()?.creator_id && room()!.creator_id !== '0' ? room()!.creator_id : undefined}
                  roomId={params.roomId}
                  onRemoveMember={handleRemoveMember}
                />
              </Show>
            }
          >
            <RoomSearchPanel
              roomId={params.roomId}
              query={searchQuery()}
              participants={room()?.participants}
              onClose={handleCloseSearch}
              onSelectMessage={handleSelectSearchedMessage}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default RoomPage;
