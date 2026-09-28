import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { appEmptyState, appEmptyStateBody, appEmptyStateIcon, appEmptyStateTitle } from '../../theme/appChrome';

export interface EmptyStateProps {
  /** Full Font Awesome class, e.g. `fa-solid fa-user-group`. */
  icon: string;
  title?: string;
  body?: string;
  action?: JSX.Element;
  /** `page` fills a content column (big icon, heading); `inline` (default) is a compact dashed frame for lists. */
  size?: 'page' | 'inline';
  class?: string;
}

/** The one "nothing here" block: friends tabs, pinned messages, add-people lists, emoji lists… */
export const EmptyState: Component<EmptyStateProps> = (props) => (
  <Show
    when={props.size === 'page'}
    fallback={
      <div class={`${appEmptyState} ${props.class ?? ''}`}>
        <i class={`${props.icon} ${appEmptyStateIcon}`} aria-hidden="true" />
        <Show when={props.title}>
          <p class={appEmptyStateTitle}>{props.title}</p>
        </Show>
        <Show when={props.body}>
          <p class={appEmptyStateBody}>{props.body}</p>
        </Show>
        {props.action}
      </div>
    }
  >
    <div class={`flex flex-1 flex-col items-center justify-center p-8 text-center ${props.class ?? ''}`}>
      <div class="mb-5 flex size-20 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/70">
        <i class={`${props.icon} text-3xl`} aria-hidden="true" />
      </div>
      <Show when={props.title}>
        <h2 class="mb-2 text-xl font-semibold text-foreground">{props.title}</h2>
      </Show>
      <Show when={props.body}>
        <p class={`max-w-md text-sm text-muted-foreground ${props.action ? 'mb-6' : ''}`}>{props.body}</p>
      </Show>
      {props.action}
    </div>
  </Show>
);
