import { Component, Show } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";

interface RoomHeaderProps {
  roomName: string;
  roomTopic?: string;
}

const RoomHeader: Component<RoomHeaderProps> = (props) => {
  const [t] = useTransContext();

  return (
    <div class="flex flex-col text-text-secondary select-none py-6 px-4 mb-2 bg-[var(--background2)] rounded-lg">
      <h2 class="text-lg font-medium text-text-primary select-none mb-1">
        @{props.roomName}
      </h2>
      <Show when={props.roomTopic && props.roomTopic.trim()}>
        <p class="text-sm text-text-secondary mb-2 italic">
          {props.roomTopic}
        </p>
      </Show>
      <p class="text-sm">
        {t('chat.startOfConversation', { defaultValue: 'This is the start of your conversation.' })}
      </p>
    </div>
  );
};

export default RoomHeader;