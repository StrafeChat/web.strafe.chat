import { Component, Show } from "solid-js";
import { parseMarkdown } from "../../../../lib/utils/markdownUtils";

interface MessageContentProps {
  content: string;
  editedAt?: string;
  isCompact?: boolean;
  pending: boolean;
  error?: string;
  onMessageClick: (event: MouseEvent) => void;
}

export const MessageContent: Component<MessageContentProps> = (props) => {
  return (
    <div class="flex items-center gap-2 overflow-hidden">
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
