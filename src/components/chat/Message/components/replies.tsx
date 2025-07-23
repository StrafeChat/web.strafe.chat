import { Component, Show, For } from "solid-js";
import { Avatar } from "../../../common/Avatar";
import { scrollToMessage } from "../utils/message";


interface MessageRepliesProps {
  refMessages: any[];
  replyMaxWidth: string;
}

// Component for individual reply message
const ReplyMessage: Component<{ refMessage: any; replyMaxWidth: string }> = (props) => {
  const displayContent = () => {
    const content = props.refMessage.content || "Click to see attachment";
    
    // Check if content is empty or just whitespace
    if (!content.trim()) {
      return "Click to see attachment";
    }
    
    // Handle different content types better
    if (content.length > 100) {
      // Find a good breaking point (preferably at a space)
      const breakPoint = content.lastIndexOf(' ', 100);
      const truncateAt = breakPoint > 80 ? breakPoint : 100;
      return content.substring(0, truncateAt) + '...';
    }
    
    return content;
  };

  return (
    <div class="relative">
      <div class="absolute left-[20px] bottom-[-2px] w-7 h-2.5 border-l-2 border-t-2 border-text-secondary opacity-40 rounded-tl-md"></div>
      <div
        class="flex items-center gap-1.5 ml-[42px] px-3 rounded hover:bg-surface hover:bg-opacity-20 cursor-pointer transition-colors overflow-hidden"
        style={{ "max-width": props.replyMaxWidth }}
        onClick={() => scrollToMessage(props.refMessage.id)}
      >
        <Avatar
          userId={props.refMessage.author_id}
          avatar={props.refMessage.avatar}
          alt="Avatar"
          class="flex-shrink-0"
          size="xs"
        />
        <span class="text-xs font-medium text-text-primary flex-shrink-0 max-w-[120px] truncate">
          {props.refMessage.author}
        </span>
        <span class="text-xs text-text-secondary truncate min-w-0 flex-1 opacity-80">
          {displayContent()}
        </span>
      </div>
    </div>
  );
};

export const MessageReplies: Component<MessageRepliesProps> = (props) => {
  return (
    <Show when={props.refMessages.length > 0}>
      <div>
        <For each={props.refMessages}>
          {(refMessage) => (
            <ReplyMessage refMessage={refMessage} replyMaxWidth={props.replyMaxWidth} />
          )}
        </For>
      </div>
    </Show>
  );
};
