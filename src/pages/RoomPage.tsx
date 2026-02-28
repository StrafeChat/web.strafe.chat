import type { Component } from 'solid-js';
import { createSignal, createEffect, createMemo, Show, onMount, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { roomDisplayName } from '../stores/rooms';
import { rooms, isNotesRoom } from '../stores/rooms';
import { auth } from '../stores/auth';
import {
  messages,
  setMessages,
  loadMessages,
  loadOlderMessages,
  sendMessage,
  type DecryptedMessage,
} from '../stores/messages';
import { typing, typingVersion, removeTyping } from '../stores/typing';
import { sendTyping, ackRoom, ackRoomKeepalive, createPM } from '../api/rooms';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { MessageList } from '../components/MessageList';
import { MessageSkeleton } from '../components/MessageSkeleton';
import { AddPeopleModal } from '../components/AddPeopleModal';
import { RoomHeader, RoomMessageInput, RoomMembersSidebar, RoomSearchPanel, RoomPinnedPanel } from '../components/room';
import { settings, setMessageCompact, setMembersPanelOpen } from '../stores/settings';
import type { SettingsData } from '../stores/settings';
import { stargate } from '../stores/stargate';
import { messageIdGt, readState, setReadState } from '../stores/readState';
import { setPendingAck, clearPendingAck, getPendingAck } from '../stores/pendingAck';
import { dismissNewHeader, clearNewHeaderDismissed } from '../stores/newHeaderDismissed';
import { getMessageBodyText, getSenderDisplay } from '../components/messageList';
import { formatMessageTimestamp } from '../lib/utils/datetime';
import { scrollToMessage } from '../lib/utils/messages';
import { pinnedMessages } from '../stores/pinnedMessages';

const TYPING_DEBOUNCE_MS = 5000;

const RoomPage: Component = () => {
  const params = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = createSignal('');
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | undefined>();
  const [maxMessageIdWhenEntered, setMaxMessageIdWhenEntered] = createSignal<string | null>(null);
  const [showAddPeople, setShowAddPeople] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [pinnedOpen, setPinnedOpen] = createSignal(false);
  const [replyToMessageId, setReplyToMessageId] = createSignal<string | null>(null);
  let lastTypingSent = 0;
  const leaveAckRef = { roomId: '' as string, toAck: '' as string };
  let prevRoomIdRef = '';
  const room = () => rooms.rooms.find((r) => r.id === params.roomId);
  const pmOtherUserId = createMemo(() => {
    const r = room();
    if (r?.type !== 1 || !auth.user?.id) return undefined;
    return r.participants?.find((p) => p.id !== auth.user?.id)?.id;
  });
  const name = () => {
    const r = room();
    return r && auth.user?.id ? roomDisplayName(r, auth.user.id) : 'Conversation';
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
    if (!r || !auth.user?.id) return 'Message...';
    const displayName = roomDisplayName(r, auth.user.id);
    return r.type === 1 ? `Message @${displayName}` : `Message ${displayName}`;
  };
  const roomMessages = () => messages.byRoom[params.roomId] ?? [];
  const isGroupRoom = () => room()?.type === 2;
  const typingUserIds = createMemo(() => {
    typingVersion();
    const roomId = params.roomId;
    if (!roomId) return [];
    const room = typing.byRoom[roomId];
    if (!room) return [];
    const now = Date.now();
    const exclude = auth.user?.id;
    return Object.entries(room)
      .filter(([uid, exp]) => exp > now && uid !== exclude)
      .map(([uid]) => uid);
  });

  const typingMessage = createMemo(() => {
    const ids = typingUserIds();
    if (ids.length === 0) return '';
    if (ids.length === 1) {
      const p = room()?.participants?.find((x) => x.id === ids[0]);
      return `${p?.display_name ?? p?.username ?? 'Someone'} is typing...`;
    }
    return ids.length === 2 ? '2 people are typing...' : 'Several people are typing...';
  });

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

  const searchResults = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return [];
    const list: DecryptedMessage[] = roomMessages();
    const r = room();
    const participants = r?.participants ?? [];
    const currentUserId = auth.user?.id;
    const matches: {
      id: string;
      preview: string;
      sender: string;
      createdAt: string;
    }[] = [];
    for (const m of list) {
      const text = getMessageBodyText(m);
      if (!text.toLowerCase().includes(q)) continue;
      const sender = getSenderDisplay(m.sender_id, participants, currentUserId);
      matches.push({
        id: m.id,
        preview: text.length > 80 ? `${text.slice(0, 77)}…` : text,
        sender: sender.name,
        createdAt: formatMessageTimestamp(new Date(m.created_at)),
      });
    }
    return matches.reverse();
  });

  function onInput(e: InputEvent) {
    setDraft((e.target as HTMLInputElement).value);
    const now = Date.now();
    if (now - lastTypingSent >= TYPING_DEBOUNCE_MS) {
      lastTypingSent = now;
      sendTyping(params.roomId).catch(() => {});
    }
  }
  const isLoading = () => messages.loading[params.roomId] ?? false;
  const isSending = () => messages.sending[params.roomId] ?? false;

  createEffect(() => {
    const roomId = params.roomId;
    if (!roomId) return;
    const cached = messages.byRoom[roomId];
    if (cached === undefined) {
      loadMessages(roomId);
      return;
    }
    if (cached.length > 0) {
      if ((messages.scrollToBottomTick[roomId] ?? 0) === 0) {
        setMessages('scrollToBottomTick', roomId, (t) => (t ?? 0) + 1);
      }
      if (messages.hasMoreOlder[roomId] === undefined) {
        setMessages('hasMoreOlder', roomId, true);
      }
    }
  });

  // Reset maxMessageIdWhenEntered when switching rooms; set when messages first load
  createEffect(() => {
    const roomId = params.roomId;
    setMaxMessageIdWhenEntered(null);
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

  // Subscribe to room when Stargate is ready (WS may not be open on mount)
  createEffect(() => {
    const roomId = params.roomId;
    if (stargate.ready && roomId) {
      subscribe(roomId, undefined);
      return () => unsubscribe(roomId, undefined);
    }
  });

  // Focus input when entering room (defer so input is mounted)
  createEffect(() => {
    const roomId = params.roomId;
    const el = inputRef();
    if (room() && roomId && el) {
      queueMicrotask(() => el.focus());
    }
  });

  // Keep leaveAckRef updated so we can ack on unmount
  createEffect(() => {
    const roomId = params.roomId;
    if (!roomId) {
      leaveAckRef.roomId = '';
      leaveAckRef.toAck = '';
      return;
    }
    const r = rooms.rooms.find((x) => x.id === roomId);
    const lastRead = readState.byRoom[roomId]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    const list = messages.byRoom[roomId] ?? [];
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    let toAck = '';
    if (snowflakes.length > 0) {
      const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
      if (messageIdGt(latest.id, lastRead ?? '0')) toAck = latest.id;
    } else if (r?.last_message_id && messageIdGt(r.last_message_id, lastRead ?? '0')) {
      toAck = r.last_message_id;
    }
    leaveAckRef.roomId = roomId;
    leaveAckRef.toAck = toAck;
  });

  // When switching to a different room, ack the room we're leaving so unread clears immediately
  createEffect(() => {
    const roomId = params.roomId;
    if (!roomId) {
      prevRoomIdRef = '';
      return;
    }
    const prevRoomId = prevRoomIdRef;
    prevRoomIdRef = roomId;
    if (!prevRoomId || prevRoomId === roomId) return;
    const r = rooms.rooms.find((x) => x.id === prevRoomId);
    const lastRead = readState.byRoom[prevRoomId]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    const list = messages.byRoom[prevRoomId] ?? [];
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    let toAck = '';
    if (snowflakes.length > 0) {
      const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
      if (messageIdGt(latest.id, lastRead ?? '0')) toAck = latest.id;
    } else if (r?.last_message_id && messageIdGt(r.last_message_id, lastRead ?? '0')) {
      toAck = r.last_message_id;
    }
    clearNewHeaderDismissed(prevRoomId);
    if (toAck) {
      setReadState('byRoom', prevRoomId, { lastReadMessageId: toAck, mentionCount: 0 });
      ackRoom(prevRoomId, toAck).catch(() => {});
    }
  });

  onCleanup(() => {
    clearPendingAck();
    if (leaveAckRef.roomId) clearNewHeaderDismissed(leaveAckRef.roomId);
    if (leaveAckRef.roomId && leaveAckRef.toAck) {
      setReadState('byRoom', leaveAckRef.roomId, {
        lastReadMessageId: leaveAckRef.toAck,
        mentionCount: 0,
      });
      ackRoom(leaveAckRef.roomId, leaveAckRef.toAck).catch(() => {});
    }
  });

  // Update pending ack for page unload (refresh/close) - keepalive survives teardown
  createEffect(() => {
    const roomId = params.roomId;
    const list = roomMessages();
    const r = room();
    if (!roomId || list.length === 0) {
      clearPendingAck();
      return;
    }
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) return;
    const latest = snowflakes.reduce((a, b) => (messageIdGt(b.id, a.id) ? b : a));
    const lastRead = readState.byRoom[roomId]?.lastReadMessageId ?? r?.last_read_message_id ?? null;
    if (messageIdGt(latest.id, lastRead ?? '0')) {
      setPendingAck(roomId, latest.id);
    } else {
      clearPendingAck();
    }
  });

  onMount(() => {
    const onBeforeUnload = () => {
      const p = getPendingAck();
      if (p) ackRoomKeepalive(p.roomId, p.messageId);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  });

  // Focus message input on keypress when not typing elsewhere (Discord-style)
  onMount(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as Node;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      if (target && document.body.contains(target)) {
        const el = target instanceof HTMLElement ? target : target.parentElement;
        if (el?.closest('[role="dialog"]') || el?.closest('[data-modal]')) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key;
      if (key.length !== 1 || key.charCodeAt(0) < 32) return;
      const input = inputRef();
      if (!input || input.disabled) return;
      e.preventDefault();
      input.focus();
      setDraft((d) => d + key);
    }
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const text = draft().trim();
    if (!text || isSending()) return;
    if (auth.user?.id) removeTyping(params.roomId, auth.user.id);
    try {
      await sendMessage(params.roomId, text, replyToMessageId() ?? undefined);
      setDraft('');
      setReplyToMessageId(null);
      inputRef()?.focus();
      dismissNewHeader(params.roomId);
    } catch (err) {
      console.error('Send failed:', err);
    }
  }

  function handleSelectSearchedMessage(messageId: string) {
    scrollToMessage(messageId);
  }

  function handleOpenSearch() {
    setSearchOpen(true);
    setPinnedOpen(false);
  }

  function handleCloseSearch() {
    setSearchOpen(false);
  }

  function handleSelectPinnedMessage(messageId: string) {
    scrollToMessage(messageId);
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

  return (
    <div class="flex-1 flex flex-col min-h-0">
      <RoomHeader
        headerIcon={headerIcon()}
        name={name()}
        pmOtherUserId={pmOtherUserId()}
        isGroup={room()?.type === 2}
        messageCompact={!!settings.messageCompact}
        onToggleCompact={() => setMessageCompact(!settings.messageCompact)}
        hasPinned={pinnedMessagesForRoom().length > 0}
        pinnedOpen={pinnedOpen()}
        onTogglePinned={handleTogglePinned}
        searchQuery={searchQuery()}
        onSearchChange={setSearchQuery}
        onSearchFocus={handleOpenSearch}
        membersPanelOpen={!!(settings as SettingsData).membersPanelOpen}
        onToggleMembers={() => setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)}
        onAddPeople={() => setShowAddPeople(true)}
      />
      <AddPeopleModal
        open={showAddPeople()}
        roomId={params.roomId}
        participantIds={room()?.participants?.map((p) => p.id) ?? []}
        onClose={() => setShowAddPeople(false)}
      />
      <Show when={pinnedOpen()}>
        <div class="fixed md:absolute top-14 right-4 z-40">
          <RoomPinnedPanel
            roomId={params.roomId}
            messages={pinnedMessagesForRoom()}
            participants={room()?.participants ?? []}
            onSelectMessage={handleSelectPinnedMessage}
          />
        </div>
      </Show>
      <div class="flex-1 flex min-h-0 overflow-hidden">
        <div class="flex-1 flex flex-col min-h-0 min-w-0">
          <Show when={!room()}>
            <div class="flex-1 flex items-center justify-center p-8 text-muted-foreground">
              <p>Conversation not found.</p>
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
                loadingOlder={messages.loadingOlder[params.roomId]}
                hasMoreOlder={messages.hasMoreOlder[params.roomId]}
                onLoadOlder={(getScroll) => loadOlderMessages(params.roomId, getScroll)}
                lastReadMessageId={
                  readState.byRoom[params.roomId]?.lastReadMessageId ??
                  room()?.last_read_message_id ??
                  null
                }
                maxMessageIdWhenEntered={maxMessageIdWhenEntered()}
                onReply={handleReplyToMessage}
              />
            }>
              <MessageSkeleton />
            </Show>
            <div class="border-t border-border">
              <Show when={replyToMessageId()}>
                {(() => {
                  const targetId = replyToMessageId();
                  const list = roomMessages();
                  const target = list.find((m) => m.id === targetId) as DecryptedMessage | undefined;
                  if (!target) {
                    return (
                      <div class="px-3 pt-2 pb-1 text-xs text-muted-foreground bg-[hsl(0_0%_8%)] flex items-center justify-between gap-2">
                        <span class="truncate">
                          Replying to message <span class="font-mono text-[10px]">#{targetId}</span>
                        </span>
                        <button
                          type="button"
                          class="text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => setReplyToMessageId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  }
                  const sender = getSenderDisplay(
                    target.sender_id,
                    room()?.participants ?? [],
                    auth.user?.id
                  );
                  const text = getMessageBodyText(target);
                  const preview =
                    text.length > 120 ? `${text.slice(0, 117)}…` : text;
                  return (
                    <div class="px-3 pt-2 pb-1 text-xs bg-[hsl(0_0%_8%)] flex items-start justify-between gap-2 border-b border-border/80">
                      <div class="min-w-0">
                        <p class="text-[11px] text-muted-foreground mb-0.5">
                          Replying to <span class="text-foreground font-medium">{sender.name}</span>
                        </p>
                        <p class="text-[12px] text-muted-foreground truncate">{preview}</p>
                      </div>
                      <button
                        type="button"
                        class="mt-0.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => {
                          if (targetId) scrollToMessage(targetId);
                        }}
                      >
                        Jump
                      </button>
                      <button
                        type="button"
                        class="mt-0.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => setReplyToMessageId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  );
                })()}
              </Show>
              <RoomMessageInput
                draft={draft()}
                onInput={onInput}
                onSubmit={handleSubmit}
                placeholder={inputPlaceholder()}
                disabled={isSending()}
                inputRef={setInputRef}
                typingMessage={typingMessage()}
                showTyping={typingUserIds().length > 0}
              />
            </div>
          </Show>
        </div>
        <Show
          when={
            room() &&
            (isGroupRoom()
              ? (settings as SettingsData).membersPanelOpen || searchOpen()
              : searchOpen())
          }
        >
          <Show
            when={searchOpen()}
            fallback={
              <Show when={isGroupRoom()}>
                <RoomMembersSidebar
                  participants={room()!.participants ?? []}
                  currentUserId={auth.user?.id}
                  onMessageUser={(userId) => {
                    createPM(userId).then((r) => navigate(`/rooms/${r.id}`)).catch((err) => console.error(err));
                  }}
                />
              </Show>
            }
          >
            <RoomSearchPanel
              query={searchQuery()}
              onQueryChange={setSearchQuery}
              onClose={handleCloseSearch}
              results={searchResults()}
              onSelectMessage={handleSelectSearchedMessage}
            />
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default RoomPage;
