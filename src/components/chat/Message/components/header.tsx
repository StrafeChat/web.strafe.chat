import { Component, Show } from "solid-js";
import { Avatar } from "../../../common/Avatar";

interface MessageHeaderProps {
  author: any;
  authorId: string;
  createdAt: string;
  isCompact?: boolean;
  pending: boolean;
  error?: string;
  deleteError: string;
  onAuthorClick: (e: MouseEvent) => void;
  avatarBouncing: boolean;
  appearance: any;
  t: any;
}

export const MessageHeader: Component<MessageHeaderProps> = (props) => {
  return (
    <Show when={!props.isCompact}>
      <div class="flex-shrink-0 mt-1">
        <Avatar
          userId={props.authorId}
          avatar={props.author?.avatar}
          alt="Avatar"
          class={`cursor-pointer hover:ring-2 hover:ring-primary transition-transform duration-300 ${
            props.avatarBouncing ? "animate-bounce" : ""
          }`}
          size="md"
          onClick={props.onAuthorClick}
        />
      </div>
    </Show>
  );
};
