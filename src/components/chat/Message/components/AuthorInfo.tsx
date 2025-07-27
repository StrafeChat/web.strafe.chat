import { Component, Show } from "solid-js";
import { formatTimestamp } from "../utils/date";

interface MessageAuthorInfoProps {
  author: any;
  createdAt: string;
  pending: boolean;
  error?: string;
  deleteError: string;
  isCompact?: boolean;
  onAuthorClick: (e: MouseEvent) => void;
  appearance: any;
  t: any;
}

export const MessageAuthorInfo: Component<MessageAuthorInfoProps> = (props) => {
  return (
    <Show when={!props.isCompact}>
      <div class="flex items-center gap-2 overflow-hidden">
        <div class="flex items-baseline gap-2 overflow-hidden">
          <span
            class="font-medium text-text-primary truncate cursor-pointer hover:underline"
            onClick={props.onAuthorClick}
          >
            {props.author?.display_name ||
              props.author?.username ||
              "Unknown User"}
          </span>
          <Show when={props.author?.bot}>
            <span class="text-xs bg-primary text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              BOT
            </span>
          </Show>
          <span class="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">
            {formatTimestamp(props.createdAt, props.t, props.appearance)}
          </span>
        </div>
        <Show when={props.pending}>
          <span class="text-xs text-text-secondary italic flex-shrink-0">
            (sending...)
          </span>
        </Show>
        <Show when={props.error}>
          <span class="text-xs text-red-500 flex-shrink-0">{props.error}</span>
        </Show>
        <Show when={props.deleteError}>
          <span class="text-xs text-red-500 flex-shrink-0">
            {props.deleteError}
          </span>
        </Show>
      </div>
    </Show>
  );
};
