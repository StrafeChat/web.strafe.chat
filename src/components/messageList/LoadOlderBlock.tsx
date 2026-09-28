import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '../ui/Button';
import { t } from '../../i18n';

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
      <div class="flex shrink-0 flex-col gap-2" aria-hidden>
        {Array.from({ length: OLDER_SKELETON_COUNT }, (_, i) => (
          <div class="-mx-2 flex gap-3 px-2 py-1">
            <div class="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-baseline gap-2">
                <div class="h-3.5 animate-pulse rounded bg-muted" style={{ width: `${60 + (i % 3) * 20}px` }} />
                <div class="h-3 w-12 animate-pulse rounded bg-muted/70" />
              </div>
              <div class="h-3.5 animate-pulse rounded bg-muted/80" style={{ width: `${80 + (i % 4) * 30}%` }} />
              {i % 2 === 0 && <div class="h-3 max-w-[75%] animate-pulse rounded bg-muted/60" />}
            </div>
          </div>
        ))}
      </div>
    </Show>
    <div ref={props.sentinelRef} class="flex h-12 shrink-0 items-center justify-center gap-2" aria-hidden>
      <Show
        when={props.loadingOlder}
        fallback={
          <Button
            size="sm"
            variant="outline"
            class="h-8 text-xs"
            onClick={() => props.hasMessages && props.onLoadOlder(props.getScrollContainer)}
          >
            {t('messages.loadOlder')}
          </Button>
        }
      >
        <span class="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      </Show>
    </div>
  </Show>
);
