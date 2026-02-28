import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';

export interface RoomSearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  results: {
    id: string;
    preview: string;
    sender: string;
    createdAt: string;
  }[];
  onSelectMessage: (messageId: string) => void;
}

export const RoomSearchPanel: Component<RoomSearchPanelProps> = (props) => (
  <aside
    class="w-60 shrink-0 border-l border-border bg-[hsl(0_0%_8%)] flex flex-col overflow-hidden hidden md:flex"
    aria-label="Search messages"
  >
    <div class="px-3 pt-4 pb-3 shrink-0 border-b border-border/70 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 shrink-0">
          <i class="fa-solid fa-magnifying-glass text-[11px]" />
          Search
        </h2>
        <div class="relative flex-1 min-w-0">
          <label class="sr-only" for="room-message-search">
            Search messages
          </label>
          <input
            id="room-message-search"
            type="search"
            value={props.query}
            onInput={(e) => props.onQueryChange(e.currentTarget.value)}
            placeholder="Search this conversation..."
            class="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <button
        type="button"
        class="size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={props.onClose}
        aria-label="Close search"
      >
        <i class="fa-solid fa-xmark text-xs" />
      </button>
    </div>
    <div class="flex-1 overflow-y-auto min-h-0 px-3 py-2">
      <Show
        when={props.query.trim().length > 0}
        fallback={
          <p class="text-xs text-muted-foreground">
            Type to search messages in this room.
          </p>
        }
      >
        <p class="text-[11px] text-muted-foreground mb-1">
          {props.results.length} result{props.results.length === 1 ? '' : 's'}
        </p>
        <div class="space-y-2">
          <For each={props.results}>
            {(r) => (
              <button
                type="button"
                class="w-full text-left rounded-md border border-border bg-[hsl(0_0%_10%)] hover:bg-[hsl(0_0%_14%)] transition-colors px-3 py-2 text-xs flex flex-col gap-1"
                onClick={() => props.onSelectMessage(r.id)}
              >
                <div class="flex items-baseline justify-between gap-2 mb-0.5">
                  <span class="text-[13px] font-semibold text-foreground truncate">
                    {r.sender}
                  </span>
                  <span class="text-[11px] text-muted-foreground shrink-0">
                    {r.createdAt}
                  </span>
                </div>
                <p class="text-[12px] text-muted-foreground whitespace-pre-wrap break-words">
                  {r.preview}
                </p>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  </aside>
);

