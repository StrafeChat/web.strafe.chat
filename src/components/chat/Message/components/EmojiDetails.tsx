import { Component, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { FS_URL } from "../../../../constants";

interface EmojiDetailsPopupProps {
  showEmojiDetails: boolean;
  selectedEmoji: {
    shortcode: string;
    emoji: { name: string; code: string };
  } | null;
  popupPosition: { x: number; y: number };
  onClose: () => void;
}

export const EmojiDetailsPopup: Component<EmojiDetailsPopupProps> = (props) => {
  return (
    <Show when={props.showEmojiDetails && props.selectedEmoji}>
      <Portal>
        <div class="fixed inset-0 z-40" onClick={props.onClose}>
          <div
            class="absolute bg-background border border-border rounded-lg p-3 shadow-lg z-50 w-[250px]"
            style={{
              left: `${props.popupPosition.x}px`,
              top: `${props.popupPosition.y}px`,
              transform: "translate(0, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center gap-3">
              <img
                src={`${FS_URL}/twemoji/${props.selectedEmoji?.emoji.code}.svg`}
                alt={props.selectedEmoji?.emoji.name}
                class="w-10 h-10 flex-shrink-0"
              />
              <div class="min-w-0">
                <div class="text-sm font-medium text-text-primary truncate">
                  :{props.selectedEmoji?.shortcode}:
                </div>
                <div class="text-xs text-text-secondary">
                  This is a default emoji, it can be used everywhere.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
