import type { Component } from 'solid-js';
import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { roomDisplayName } from '../stores/rooms';
import { rooms } from '../stores/rooms';
import { auth } from '../stores/auth';
import { messages, loadMessages, sendMessage } from '../stores/messages';
import { subscribe, unsubscribe } from '../services/stargate/client';
import { MessageList } from '../components/MessageList';
import { settings, setMessageCompact } from '../stores/settings';
import { stargate } from '../stores/stargate';

const RoomPage: Component = () => {
  const params = useParams<{ roomId: string }>();
  const [draft, setDraft] = createSignal('');
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
  const isLoading = () => messages.loading[params.roomId] ?? false;
  const isSending = () => messages.sending[params.roomId] ?? false;

  onMount(() => {
    if (params.roomId) loadMessages(params.roomId);
  });

  // Subscribe to room when Stargate is ready (WS may not be open on mount)
  createEffect(() => {
    const roomId = params.roomId;
    if (stargate.ready && roomId) {
      subscribe(roomId, undefined);
      return () => unsubscribe(roomId, undefined);
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const text = draft().trim();
    if (!text || isSending()) return;
    try {
      await sendMessage(params.roomId, text);
      setDraft('');
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
          <Show when={isLoading()}>
            <div class="flex-1 flex items-center justify-center p-8">
              <span class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </Show>
          <Show when={!isLoading()}>
            <MessageList
              messages={roomMessages()}
              participants={room()?.participants}
            />
            <form
              onSubmit={handleSubmit}
              class="p-3 border-t border-border shrink-0"
            >
              <div class="flex gap-2">
                <input
                  type="text"
                  value={draft()}
                  onInput={(e) => setDraft(e.currentTarget.value)}
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
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default RoomPage;
