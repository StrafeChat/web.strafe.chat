import type { Component } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';

export interface RoomMessageInputProps {
  draft: string;
  onInput: (e: InputEvent) => void;
  onSubmit: (e: Event) => void;
  placeholder: string;
  disabled: boolean;
  inputRef: (el: HTMLTextAreaElement | undefined) => void;
  typingMessage: string;
  showTyping: boolean;
  /** Room participants for @mention dropdown (excluding current user if provided) */
  participants?: RoomParticipant[];
  currentUserId?: string;
  /** Current selection start in the input (for mention trigger detection) */
  cursorPos?: number;
  /** Called when user selects a mention: insert <@userId> from queryStart to cursorEnd */
  onInsertMention?: (queryStart: number, cursorEnd: number, userId: string) => void;
  /** Optional: sync cursor position when user moves caret without typing (arrows, click) */
  onCursorChange?: (pos: number) => void;
}

function participantDisplayName(p: RoomParticipant): string {
  return p.display_name || p.username || 'Unknown';
}

export const RoomMessageInput: Component<RoomMessageInputProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const mentionState = createMemo(() => {
    const draft = props.draft;
    const pos = props.cursorPos ?? draft.length;
    const participants = props.participants ?? [];
    const currentUserId = props.currentUserId;
    const textBefore = draft.slice(0, pos);
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex === -1) return null;
    // Require @ at start of line or after whitespace so we don't trigger mid-word
    const prevChar = atIndex > 0 ? textBefore[atIndex - 1] : ' ';
    if (prevChar !== ' ' && prevChar !== '\n') return null;
    const query = textBefore.slice(atIndex + 1).toLowerCase();
    const others = currentUserId
      ? participants.filter((p) => p.id !== currentUserId)
      : participants;
    const filtered =
      query === ''
        ? others
        : others.filter((p) => {
            const name = participantDisplayName(p).toLowerCase();
            const username = (p.username ?? '').toLowerCase();
            return name.startsWith(query) || username.startsWith(query);
          });
    if (filtered.length === 0) return null;
    return { queryStart: atIndex, cursorEnd: pos, query, list: filtered };
  });

  const mentionOpen = () => mentionState() !== null;
  const mentionList = () => mentionState()?.list ?? [];
  const maxIndex = () => Math.max(0, mentionList().length - 1);
  const effectiveSelectedIndex = () => Math.min(selectedIndex(), maxIndex());

  function handleKeyDown(e: KeyboardEvent) {
    const state = mentionState();
    if (state) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIndex()));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        const list = mentionList();
        const idx = effectiveSelectedIndex();
        const user = list[idx];
        if (user && props.onInsertMention) {
          e.preventDefault();
          props.onInsertMention(state.queryStart, state.cursorEnd, user.id);
          setSelectedIndex(0);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSelectedIndex(0);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (props.draft.trim() && !props.disabled) {
        (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
      }
    }
  }

  function handleSelect(userId: string) {
    const state = mentionState();
    if (!state || !props.onInsertMention) return;
    props.onInsertMention(state.queryStart, state.cursorEnd, userId);
    setSelectedIndex(0);
  }

  return (
    <>
      <form onSubmit={props.onSubmit} class="p-3 shrink-0">
        <div class="flex gap-2 relative">
          <textarea
            ref={props.inputRef}
            value={props.draft}
            onInput={props.onInput}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => props.onCursorChange?.((e.target as HTMLTextAreaElement).selectionStart)}
            onClick={(e) => props.onCursorChange?.((e.target as HTMLTextAreaElement).selectionStart)}
            placeholder={props.placeholder}
            rows={1}
            class="flex-1 min-h-[44px] max-h-[200px] resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          <Show when={mentionOpen()}>
            <div
              class="absolute left-2 right-12 md:right-2 bottom-full mb-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1 z-10"
              role="listbox"
              aria-label="Mention a user"
            >
              {mentionList().map((p, i) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={i === effectiveSelectedIndex()}
                  class={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    i === effectiveSelectedIndex() ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-muted/70'
                  }`}
                  onClick={() => handleSelect(p.id)}
                >
                  <div class="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                    {(p.display_name || p.username || '?')[0].toUpperCase()}
                  </div>
                  <span class="truncate">{participantDisplayName(p)}</span>
                </button>
              ))}
            </div>
          </Show>
        </div>
      </form>
      <div class="h-3 flex items-center px-4 min-h-0 pb-3">
        <Show when={props.showTyping}>
          <p class="text-xs text-muted-foreground">{props.typingMessage}</p>
        </Show>
      </div>
    </>
  );
};
