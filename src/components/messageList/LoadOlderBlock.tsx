import type { Component } from 'solid-js';
import { Show } from 'solid-js';

const OLDER_SKELETON_COUNT = 4;

export interface LoadOlderBlockProps {
  hasMessages: boolean;
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  sentinelRef: (el: HTMLDivElement) => void;
  onLoadOlder: (getScrollContainer: () => HTMLDivElement | undefined) => void;
  getScrollContainer: () => HTMLDivElement | undefined;
}

export const LoadOlderBlock: Component<LoadOlderBlockProps> = (props) => (
  <Show when={props.hasMessages && props.hasMoreOlder}>
    <Show when={props.loadingOlder}>
      <div class="flex flex-col gap-2 shrink-0" aria-hidden>
        {Array.from({ length: OLDER_SKELETON_COUNT }, (_, i) => (
          <div class="flex gap-3 -mx-2 px-2 py-1">
            <div class="size-10 shrink-0 rounded-full bg-muted animate-pulse" />
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex items-baseline gap-2">
                <div
                  class="h-3.5 rounded bg-muted animate-pulse"
                  style={{ width: `${60 + (i % 3) * 20}px` }}
                />
                <div class="h-3 rounded bg-muted/70 animate-pulse w-12" />
              </div>
              <div
                class="h-3.5 rounded bg-muted/80 animate-pulse"
                style={{ width: `${80 + (i % 4) * 30}%` }}
              />
              {i % 2 === 0 && (
                <div class="h-3 rounded bg-muted/60 animate-pulse max-w-[75%]" />
              )}
            </div>
          </div>
        ))}
      </div>
    </Show>
    <div
      ref={props.sentinelRef}
      class="h-12 shrink-0 flex items-center justify-center gap-2"
      aria-hidden
    >
      <Show
        when={props.loadingOlder}
        fallback={
          <button
            type="button"
            onClick={() => props.hasMessages && props.onLoadOlder(props.getScrollContainer)}
            class="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded border border-border hover:bg-accent/50 transition-colors"
          >
            Load older messages
          </button>
        }
      >
        <span class="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      </Show>
    </div>
  </Show>
);
