import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show } from 'solid-js';
import type { DecryptedMessage } from '../stores/messages';
import type { RoomParticipant } from '../api/rooms';
import { auth } from '../stores/auth';
import { settings } from '../stores/settings';
import { formatMessageTimestamp } from '../lib/utils/datetime';

const MESSAGE_GROUP_THRESHOLD_MS = 5 * 60 * 1000;

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
  participants?: RoomParticipant[];
  compact?: boolean;
}

export const MessageList: Component<MessageListProps> = (props) => {
  const listRef = createSignal<HTMLDivElement>();
  const currentUserId = () => auth.user?.id;
  const compact = () => props.compact !== undefined ? props.compact : settings.messageCompact;

  createEffect(() => {
    const el = listRef[0]?.();
    const msgs = props.messages;
    if (el && msgs.length) el.scrollTop = el.scrollHeight;
  });

  function shouldShowHeader(msg: DecryptedMessage, prev: DecryptedMessage | undefined): boolean {
    if (!prev) return true;
    if (prev.sender_id !== msg.sender_id) return true;
    const prevTime = new Date(prev.created_at).getTime();
    const currTime = new Date(msg.created_at).getTime();
    if (currTime - prevTime > MESSAGE_GROUP_THRESHOLD_MS) return true;
    return false;
  }

  return (
    <div
      ref={(el) => listRef[1](el)}
      class="flex-1 overflow-y-auto flex flex-col min-h-0"
      style={{ 'overflow-anchor': 'auto' }}
    >
      <div class="flex flex-col p-4 gap-1 min-h-full justify-end">
        <Show when={props.messages.length === 0}>
          <p class="text-center text-muted-foreground text-sm py-8">No messages yet. Say hello!</p>
        </Show>
        <For each={props.messages}>
          {(msg, i) => {
            const prev = () => props.messages[i() - 1];
            const showHeader = () => shouldShowHeader(msg, prev());
            const sender = () =>
              getSenderDisplay(msg.sender_id, props.participants, currentUserId());

            return (
              <div class="flex gap-3 hover:bg-[hsl(var(--background)/0.3)] -mx-2 px-2 py-0.5 rounded group">
                <Show when={!compact()}>
                  <Show
                    when={showHeader()}
                    fallback={<div class="size-10 shrink-0" />}
                  >
                    <Avatar name={sender().name} avatar={sender().avatar} />
                  </Show>
                </Show>
                <div class="flex-1 min-w-0">
                  <Show when={showHeader()}>
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <span class="font-semibold text-foreground shrink-0">{sender().name}</span>
                      <span class="text-xs text-muted-foreground shrink-0">
                        {formatMessageTimestamp(new Date(msg.created_at))}
                      </span>
                    </div>
                  </Show>
                  <p class="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                    {msg.plaintext ?? (msg.decryptError ? '[Unable to decrypt]' : '...')}
                  </p>
                  <Show when={msg.pending}>
                    <span class="text-[10px] text-muted-foreground/70">Sending...</span>
                  </Show>
                  <Show when={msg.notEncrypted && !msg.pending}>
                    <span class="text-[10px] text-amber-500/90">Not encrypted</span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
