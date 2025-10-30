import { Component } from "solid-js";
import { UnifiedEmojiPicker } from "./UnifiedEmojiPicker";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export const EmojiPicker: Component<EmojiPickerProps> = (props) => {
  return (
    <UnifiedEmojiPicker
      onSelect={props.onSelect}
      onClose={props.onClose}
      position={props.position}
    />
  );
};
