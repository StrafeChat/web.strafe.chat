import type { Component } from 'solid-js';
import { Show } from 'solid-js';

export interface RoomMessageInputProps {
  draft: string;
  onInput: (e: InputEvent) => void;
  onSubmit: (e: Event) => void;
  placeholder: string;
  disabled: boolean;
  inputRef: (el: HTMLInputElement | undefined) => void;
  typingMessage: string;
  showTyping: boolean;
}

export const RoomMessageInput: Component<RoomMessageInputProps> = (props) => (
  <>
    <form onSubmit={props.onSubmit} class="p-3 shrink-0">
      <div class="flex gap-2">
        <input
          ref={props.inputRef}
          type="text"
          value={props.draft}
          onInput={props.onInput}
          placeholder={props.placeholder}
          class="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={props.disabled}
        />
        <button
          type="submit"
          disabled={!props.draft.trim() || props.disabled}
          class="md:hidden p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
          title="Send"
          aria-label="Send"
        >
          <i class={`fa-solid fa-paper-plane text-sm ${props.disabled ? 'opacity-70' : ''}`} />
        </button>
      </div>
    </form>
    <div class="h-3 flex items-center px-4 min-h-0 pb-3">
      <Show when={props.showTyping}>
        <p class="text-xs text-muted-foreground">{props.typingMessage}</p>
      </Show>
    </div>
  </>
);
