import { Component, Show, For } from "solid-js";
import { Avatar } from "../../../common/Avatar";
import { scrollToMessage } from "../utils/message";

interface MessageRepliesProps {
  refMessages: any[];
  replyMaxWidth: string;
}

export const MessageReplies: Component<MessageRepliesProps> = (props) => {
  return (
    <Show when={props.refMessages.length > 0}>
      <div>
        <For each={props.refMessages}>
          {(refMessage) => (
            <div class="relative">
              <div class="absolute left-[20px] bottom-[-2px] w-7 h-2.5 border-l-2 border-t-2 border-text-secondary opacity-40 rounded-tl-md"></div>
              <div
                class="flex items-center gap-1.5 ml-[42px] px-3 rounded hover:bg-surface hover:bg-opacity-20 cursor-pointer transition-colors overflow-hidden"
                style={{ "max-width": props.replyMaxWidth }}
                onClick={() => scrollToMessage(refMessage.id)}
              >
                <Avatar
                  userId={refMessage.author_id}
                  avatar={refMessage.avatar}
                  alt="Avatar"
                  class="flex-shrink-0"
                  size="xs"
                />
                <span class="text-xs font-medium text-text-primary flex-shrink-0 max-w-[120px] truncate">
                  {refMessage.author}
                </span>
                <span class="text-xs text-text-secondary opacity-80 truncate min-w-0 flex-1">
                  {refMessage.content || "Click to see attachment"}
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};
