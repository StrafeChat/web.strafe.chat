import { Component, Show } from "solid-js";
import { parseMarkdown } from "../../../../lib/utils/markdownUtils";
import { E2EEMessageContent } from "../../E2EEMessageContent";

interface MessageContentProps {
  content: string;
  editedAt?: string;
  isCompact?: boolean;
  pending: boolean;
  error?: string;
  onMessageClick: (event: MouseEvent) => void;
  roomId?: string;
  messageId?: string;
  senderId?: string;
}

export const MessageContent: Component<MessageContentProps> = (props) => {
  // Check if content might be E2EE encrypted
  const isE2EEContent = () => {
    return props.content.startsWith('E2EE:') && props.roomId && props.messageId;
  };

  return (
    <div class="flex items-center gap-2 overflow-hidden">
      <Show when={isE2EEContent()} fallback={
        <div
          class="text-text-primary max-w-full message-content whitespace-pre-wrap overflow-hidden overflow-wrap-anywhere min-w-0 flex-1"
          data-edited={props.editedAt ? "true" : undefined}
          style="word-break: break-word; overflow-wrap: break-word; max-width: 100%;"
          onClick={props.onMessageClick}
        >
          <span
            class="markdown-content"
            innerHTML={parseMarkdown(props.content)}
          />
        </div>
      }>
        <E2EEMessageContent
          content={props.content}
          roomId={props.roomId!}
          messageId={props.messageId!}
          senderId={props.senderId}
          editedAt={props.editedAt}
          onMessageClick={props.onMessageClick}
        />
      </Show>
      <Show when={props.isCompact && props.pending}>
        <span class="text-xs text-text-secondary italic flex-shrink-0">
          (sending...)
        </span>
      </Show>
      <Show when={props.isCompact && props.error}>
        <span class="text-xs text-red-500 flex-shrink-0">{props.error}</span>
      </Show>
    </div>
  );
};
