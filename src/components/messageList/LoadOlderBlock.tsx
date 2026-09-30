import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Button } from '../ui/Button';
import { MessageSkeletonRows } from '../MessageSkeleton';
import { t } from '../../i18n';

const OLDER_SKELETON_GROUPS = 4;

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
      <MessageSkeletonRows groups={OLDER_SKELETON_GROUPS} class="shrink-0" />
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
