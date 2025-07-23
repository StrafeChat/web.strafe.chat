import { Component } from "solid-js";

interface EveryoneMentionProps {
  className?: string;
}

export const EveryoneMention: Component<EveryoneMentionProps> = (props) => {
  return (
    <span 
      class={`mention mention-everyone bg-red-500 bg-opacity-20 text-red-500 px-1 rounded cursor-pointer hover:bg-opacity-30 transition-colors font-semibold ${props.className || ''}`}
      title="@everyone"
    >
      @everyone
    </span>
  );
};