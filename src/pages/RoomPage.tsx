import type { Component } from 'solid-js';
import { createSignal, createEffect, createMemo, Show, For, onMount, onCleanup } from 'solid-js';
import { useParams } from '@solidjs/router';
import { roomDisplayName } from '../stores/rooms';
import { rooms, isNotesRoom } from '../stores/rooms';
import { auth } from '../stores/auth';
import { messages, setMessages, loadMessages, loadOlderMessages, sendMessage } from '../stores/messages';
import { typing, typingVersion, removeTyping } from '../stores/typing';
import { sendTyping, ackRoom, ackRoomKeepalive } from '../api/rooms';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { MessageList } from '../components/MessageList';
import { MessageSkeleton } from '../components/MessageSkeleton';
import { PresenceDot } from '../components/PresenceDot';
import { AddPeopleModal } from '../components/AddPeopleModal';
import { settings, setMessageCompact, setMembersPanelOpen } from '../stores/settings';
import type { SettingsData } from '../stores/settings';
import { stargate } from '../stores/stargate';
import { messageIdGt, readState, setReadState } from '../stores/readState';
import { setPendingAck, clearPendingAck, getPendingAck } from '../stores/pendingAck';
import { dismissNewHeader, clearNewHeaderDismissed } from '../stores/newHeaderDismissed';

const TYPING_DEBOUNCE_MS = 5000;

const RoomPage: Component = () => {
  const params = useParams<{ roomId: string }>();
  const [draft, setDraft] = createSignal('');
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | undefined>();
  const [maxMessageIdWhenEntered, setMaxMessageIdWhenEntered] = createSignal<string | null>(null);
  const [showAddPeople, setShowAddPeople] = createSignal(false);
  let lastTypingSent = 0;
  const leaveAckRef = { roomId: '' as string, toAck: '' as string };
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
      await sendMessage(params.roomId, text);
      setDraft('');
      inputRef()?.focus();
      dismissNewHeader(params.roomId);
    } catch (err) {
      console.error('Send failed:', err);
    }
  }

  return (
    <div class="flex-1 flex flex-col min-h-0">
      <div class="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <i class={`fa-solid ${headerIcon()} text-muted-foreground shrink-0`} />
          <h1 class="text-base font-semibold text-foreground truncate">{name()}</h1>
          <Show when={pmOtherUserId()}>
            {(uid) => <PresenceDot userId={uid()} class="size-2 shrink-0 mt-0.5" />}
          </Show>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <Show when={room()?.type === 2}>
            <button
              type="button"
              class={`p-2 rounded transition-colors ${
                (settings as SettingsData).membersPanelOpen
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title={(settings as SettingsData).membersPanelOpen ? 'Hide members' : 'Show members'}
              onClick={() => setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)}
              aria-label={(settings as SettingsData).membersPanelOpen ? 'Hide members' : 'Show members'}
              aria-pressed={(settings as SettingsData).membersPanelOpen}
            >
              <i class="fa-solid fa-user-group text-sm" />
            </button>
            <button
              type="button"
              class="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Add people"
              onClick={() => setShowAddPeople(true)}
              aria-label="Add people"
            >
              <i class="fa-solid fa-user-plus text-sm" />
            </button>
          </Show>
          <button
            type="button"
            onclick={() => setMessageCompact(!settings.messageCompact)}
            class="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
            title={settings.messageCompact ? 'Switch to normal' : 'Switch to compact'}
          >
            {settings.messageCompact ? 'Normal' : 'Compact'}
          </button>
        </div>
      </div>
      <AddPeopleModal
        open={showAddPeople()}
        roomId={params.roomId}
        participantIds={room()?.participants?.map((p) => p.id) ?? []}
        onClose={() => setShowAddPeople(false)}
      />
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
              />
            }>
              <MessageSkeleton />
            </Show>
            <form
              onSubmit={handleSubmit}
              class="p-3 shrink-0"
            >
              <div class="flex gap-2">
                <input
                  ref={(el) => setInputRef(el)}
                  type="text"
                  value={draft()}
                  onInput={onInput}
                  placeholder={inputPlaceholder()}
                  class="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSending()}
                />
                <button
                  type="submit"
                  disabled={!draft().trim() || isSending()}
                  class="md:hidden p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
                  title="Send"
                  aria-label="Send"
                >
                  <i class={`fa-solid fa-paper-plane text-sm ${isSending() ? 'opacity-70' : ''}`} />
                </button>
              </div>
            </form>
            <div class="h-3 flex items-center px-4 min-h-0 pb-3">
              <Show when={typingUserIds().length > 0}>
                <p class="text-xs text-muted-foreground">{typingMessage()}</p>
              </Show>
            </div>
          </Show>
        </div>
        <Show when={room()?.type === 2 && (settings as SettingsData).membersPanelOpen}>
          <aside
            class="w-60 shrink-0 border-l border-border bg-[hsl(0_0%_8%)] flex flex-col overflow-hidden hidden md:flex"
            aria-label="Group members"
          >
            <div class="px-3 pt-4 shrink-0">
              <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Members — {room()!.participants?.length ?? 0}
              </h2>
            </div>
            <div class="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
              <For each={room()!.participants ?? []}>
                {(p) => {
                  const displayName = () => p.display_name || p.username || 'Unknown';
                  const isSelf = () => p.id === auth.user?.id;
                  return (
                    <div class="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/30 transition-colors">
                      <div class="relative shrink-0">
                        <div class="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {displayName()[0].toUpperCase()}
                        </div>
                        <span class="absolute bottom-[-1px] right-[-1px]">
                          <PresenceDot userId={p.id} class="size-3.5" />
                        </span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate">
                          {displayName()}
                          <Show when={isSelf()}>
                            <span class="text-muted-foreground font-normal ml-1">(you)</span>
                          </Show>
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                          @{p.username}
                        </p>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </aside>
        </Show>
      </div>
    </div>
  );
};

export default RoomPage;
