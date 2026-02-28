import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import { getMessageBodyText, getSenderDisplay } from '../messageList';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { auth } from '../../stores/auth';
import { unpinMessage } from '../../stores/pinnedMessages';

export interface RoomPinnedPanelProps {
  roomId?: string;
  messages: DecryptedMessage[];
  participants?: RoomParticipant[];
  onSelectMessage: (messageId: string) => void;
}

export const RoomPinnedPanel: Component<RoomPinnedPanelProps> = (props) => {
  const currentUserId = () => auth.user?.id;

  return (
    <aside
      class="w-72 md:w-80 border border-border bg-[hsl(0_0%_8%)] flex flex-col overflow-hidden rounded-md shadow-xl"
      aria-label="Pinned messages"
    >
      <div class="px-3 pt-4 pb-3 shrink-0 border-b border-border/70 flex items-center justify-between gap-2">
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <i class="fa-solid fa-thumbtack text-[11px]" />
          Pinned Messages
        </h2>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0 px-3 py-2">
        <Show
          when={props.messages.length > 0}
          fallback={
            <p class="text-xs text-muted-foreground">
              There are no pinned messages in this conversation yet.
            </p>
          }
        >
          <div class="space-y-2">
            <For each={props.messages}>
              {(msg) => {
                const sender = () =>
                  getSenderDisplay(msg.sender_id, props.participants, currentUserId());
                const body = () => getMessageBodyText(msg);
                return (
                  <button
                    type="button"
                    class="w-full text-left rounded-md border border-border bg-[hsl(0_0%_10%)] hover:bg-[hsl(0_0%_14%)] transition-colors px-3 py-2 text-xs flex flex-col gap-1"
                    onClick={() => props.onSelectMessage(msg.id)}
                  >
                    <div class="flex items-start gap-2">
                      <div class="shrink-0">
                        <div class="size-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium">
                          {sender().name[0]?.toUpperCase() ?? '?'}
                        </div>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-2 mb-0.5">
                          <span class="text-[13px] font-semibold text-foreground truncate">
                            {sender().name}
                          </span>
                          <span class="text-[11px] text-muted-foreground shrink-0">
                            {formatMessageTimestamp(new Date(msg.created_at))}
                          </span>
                        </div>
                        <p class="text-[12px] text-muted-foreground whitespace-pre-wrap break-words">
                          {body()}
                        </p>
                      </div>
                    </div>
                    <Show when={props.roomId}>
                      <div class="flex justify-end mt-1">
                        <button
                          type="button"
                          class="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (props.roomId) {
                              unpinMessage(props.roomId, msg.id);
                            }
                          }}
                        >
                          <i class="fa-solid fa-times text-[9px]" />
                          Unpin
                        </button>
                      </div>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </aside>
  );
};

