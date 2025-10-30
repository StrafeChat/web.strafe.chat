import { Component } from "solid-js";
import { UnifiedEmojiPicker } from "../../../shared/UnifiedEmojiPicker";

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  triggerRef?: HTMLElement;
}

export const EmojiPicker: Component<EmojiPickerProps> = (props) => {
  const handleEmojiSelect = (emoji: string) => {
    props.onEmojiSelect(emoji);
    props.onClose();
  };

  return (
    <UnifiedEmojiPicker
      isOpen={props.isOpen}
      onSelect={handleEmojiSelect}
      onClose={props.onClose}
      triggerRef={props.triggerRef}
      mode="reaction"
    />
  );
};
