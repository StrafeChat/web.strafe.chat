import type { Component } from 'solid-js';
import { Show, Portal } from 'solid-js/web';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { getMessageBodyText, getSenderDisplay } from './utils';
import { MessageAvatar } from './MessageAvatar';

export interface DeleteMessageModalProps {
  pending: { roomId: string; msgId: string; message: DecryptedMessage } | null;
  participants?: RoomParticipant[];
  currentUserId: string | undefined;
  onConfirm: (roomId: string, msgId: string) => void;
  onCancel: () => void;
}

export const DeleteMessageModal: Component<DeleteMessageModalProps> = (props) => (
  <Show when={props.pending}>
    {(pd) => {
      const msg = () => pd().message;
      const sender = () => getSenderDisplay(msg().sender_id, props.participants, props.currentUserId);
      return (
        <Portal>
          <div
            class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
            onClick={props.onCancel}
            role="presentation"
          >
            <div
              class="w-full max-w-md rounded-lg border border-border bg-[hsl(0_0%_10%)] p-5 shadow-xl relative"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="delete-message-title"
              aria-modal="true"
            >
              <button
                type="button"
                class="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={props.onCancel}
                aria-label="Close"
              >
                <i class="fa-solid fa-times text-sm" />
              </button>
              <h2 id="delete-message-title" class="text-base font-semibold text-foreground mb-1 pr-8">
                Delete Message
              </h2>
              <p class="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete this message?
              </p>
              <div class="rounded-md border border-border bg-[hsl(0_0%_8%)] p-3 mb-4">
                <div class="flex gap-3">
                  <MessageAvatar name={sender().name} avatar={sender().avatar} />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-2 flex-wrap mb-0.5">
                      <span class="text-sm font-semibold text-primary truncate">{sender().name}</span>
                      <span class="text-xs text-muted-foreground shrink-0">
                        {formatMessageTimestamp(new Date(msg().created_at))}
                      </span>
                    </div>
                    <p class="text-sm text-muted-foreground break-words whitespace-pre-wrap">
                      {getMessageBodyText(msg())}
                    </p>
                  </div>
                </div>
              </div>
              <p class="text-xs mb-4">
                <span class="text-green-600 dark:text-green-400 font-medium">PROTIP:</span>
                <span class="text-muted-foreground ml-1">
                  You can hold down shift when clicking <strong class="text-foreground">delete message</strong> to bypass this confirmation entirely.
                </span>
              </p>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
                  onClick={props.onCancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  onClick={() => props.onConfirm(pd().roomId, pd().msgId)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </Portal>
      );
    }}
  </Show>
);
