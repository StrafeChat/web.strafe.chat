import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { MessageSkeletonRows } from '../MessageSkeleton';

const EDGE_SKELETON_GROUPS = 4;

export interface HistoryEdgeProps {
  /** Whether more history exists past this edge of the loaded window. */
  more: boolean;
  /** Which edge this is. The sentinel sits on the side facing the loaded messages. */
  side: 'older' | 'newer';
  sentinelRef: (el: HTMLDivElement) => void;
}

/**
 * The placeholder past either end of the loaded window while more history exists there -
 * Discord's skeleton rows. There is no button: scrolling toward the edge (the sentinel) pages
 * the next batch in, and the rows are what the viewer sees for the moment the fetch takes,
 * replaced in place by the real messages when they arrive.
 */
export const HistoryEdge: Component<HistoryEdgeProps> = (props) => (
  <Show when={props.more}>
    <div class="shrink-0" aria-hidden="true" data-history-edge={props.side}>
      <Show when={props.side === 'newer'}>
        <div ref={props.sentinelRef} class="h-px" />
      </Show>
      <MessageSkeletonRows groups={EDGE_SKELETON_GROUPS} />
      <Show when={props.side === 'older'}>
        <div ref={props.sentinelRef} class="h-px" />
      </Show>
    </div>
  </Show>
);
