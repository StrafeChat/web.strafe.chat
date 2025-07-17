import { Component, Show } from "solid-js";
import { Tooltip } from "../../../common/Tooltip";

interface MessageHoverMenuProps {
  canEdit: boolean;
  canDelete: boolean;
  onReply?: (messageId: string) => void;
  onEdit: () => void;
  onDelete: (shiftPressed?: boolean) => void;
  messageId?: string;
}

export const MessageHoverMenu: Component<MessageHoverMenuProps> = (props) => {
  return (
    <div class="absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-0.5 bg-background border border-border rounded-md shadow-lg z-20 transform -translate-y-1/2">
      <Show when={props.onReply && props.messageId}>
        <Tooltip content="Reply" position="top">
          <button
            class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
            onClick={() => props.onReply?.(props.messageId!)}
          >
            <svg
              class="w-4 h-4 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
        </Tooltip>
      </Show>
      <Show when={props.canEdit}>
        <Tooltip content="Edit" position="top">
          <button
            class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
            onClick={props.onEdit}
          >
            <svg
              class="w-4 h-4 text-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </Tooltip>
      </Show>
      <Show when={props.canDelete}>
        <Tooltip content="Delete" position="top">
          <button
            class="p-1.5 hover:bg-surface hover:bg-opacity-10 rounded-md transition-colors"
            onClick={(e) => props.onDelete(e.shiftKey)}
          >
            <svg
              class="w-4 h-4 text-text-secondary hover:text-red-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </Tooltip>
      </Show>
    </div>
  );
};
