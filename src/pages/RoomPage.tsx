import type { Component } from 'solid-js';
import { createSignal, createEffect, createMemo, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { roomDisplayName } from '../stores/rooms';
import { rooms } from '../stores/rooms';
import { auth } from '../stores/auth';
import { messages, setMessages, loadMessages, loadOlderMessages, sendMessage } from '../stores/messages';
import { typing, typingVersion, removeTyping } from '../stores/typing';
import { sendTyping } from '../api/rooms';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { MessageList } from '../components/MessageList';
import { MessageSkeleton } from '../components/MessageSkeleton';
import { settings, setMessageCompact } from '../stores/settings';
import { stargate } from '../stores/stargate';

const TYPING_DEBOUNCE_MS = 5000;

const RoomPage: Component = () => {
  const params = useParams<{ roomId: string }>();
  const [draft, setDraft] = createSignal('');
  const [inputRef, setInputRef] = createSignal<HTMLInputElement | undefined>();
  let lastTypingSent = 0;
  const room = () => rooms.rooms.find((r) => r.id === params.roomId);
  const name = () => {
    const r = room();
    return r && auth.user?.id ? roomDisplayName(r, auth.user.id) : 'Conversation';
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

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const text = draft().trim();
    if (!text || isSending()) return;
    if (auth.user?.id) removeTyping(params.roomId, auth.user.id);
    try {
      await sendMessage(params.roomId, text);
      setDraft('');
      inputRef()?.focus();
    } catch (err) {
      console.error('Send failed:', err);
    }
  }

  return (
    <div class="flex-1 flex flex-col min-h-0">
      <div class="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
        <h1 class="text-base font-semibold text-foreground">{name()}</h1>
        <button
          type="button"
          onclick={() => setMessageCompact(!settings.messageCompact)}
          class="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
          title={settings.messageCompact ? 'Switch to normal' : 'Switch to compact'}
        >
          {settings.messageCompact ? 'Normal' : 'Compact'}
        </button>
      </div>
      <div class="flex-1 flex flex-col min-h-0">
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
                  class="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
    </div>
  );
};

export default RoomPage;
