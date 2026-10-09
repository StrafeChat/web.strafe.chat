import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

export interface AdminTabItem<T extends string> {
  id: T;
  /** Full Font Awesome class, e.g. `fa-solid fa-users`. */
  icon: string;
  label: string;
  /** Optional badge, e.g. the number of open reports. Hidden when zero/undefined. */
  count?: number;
}

interface AdminTabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  items: AdminTabItem<T>[];
}

/**
 * The admin desk's primary navigation: an icon-and-label row with a glowing active pill
 * and an underline that grows in. Wider and calmer than the shared `Tabs` control so the
 * console reads as its own place, and each tab states what it is with an icon.
 */
export function AdminTabs<T extends string>(props: AdminTabsProps<T>): JSX.Element {
  return (
    <div role="tablist" class="flex flex-wrap items-center gap-1" data-admin-tabs>
      <For each={props.items}>
        {(item) => {
          const active = () => props.value === item.id;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active()}
              class={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active()
                  ? 'bg-primary/15 text-foreground shadow-sm ring-1 ring-inset ring-primary/30'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              data-admin-tab={item.id}
              onClick={() => props.onChange(item.id)}
            >
              <i
                class={`fa-solid ${item.icon} text-[13px] transition-transform duration-200 ${
                  active() ? 'scale-110 text-primary' : 'group-hover:scale-110'
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <Show when={item.count != null && item.count > 0}>
                <span
                  class={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors ${
                    active() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.count}
                </span>
              </Show>
              <span
                class={`pointer-events-none absolute inset-x-3 -bottom-px h-0.5 origin-center rounded-full bg-primary transition-transform duration-300 ease-out ${
                  active() ? 'scale-x-100' : 'scale-x-0'
                }`}
                aria-hidden="true"
              />
            </button>
          );
        }}
      </For>
    </div>
  );
}

interface AdminFilterTabsProps<T extends string> extends AdminTabsProps<T> {
  class?: string;
  /** Accessible name for the group, e.g. "Report status". */
  label?: string;
}

/**
 * The in-panel sibling of {@link AdminTabs}: a segmented control for filtering one tab's
 * list (report status, queue status). Same icon-and-count language, but framed as a single
 * pill so it reads as a filter rather than navigation.
 */
export function AdminFilterTabs<T extends string>(props: AdminFilterTabsProps<T>): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={props.label}
      class={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-card/40 p-1 ${props.class ?? ''}`}
      data-admin-filter-tabs
    >
      <For each={props.items}>
        {(item) => {
          const active = () => props.value === item.id;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active()}
              class={`group flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active()
                  ? 'bg-primary/15 text-foreground shadow-sm ring-1 ring-inset ring-primary/30'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              data-admin-filter-tab={item.id}
              onClick={() => props.onChange(item.id)}
            >
              <i
                class={`fa-solid ${item.icon} text-xs transition-transform duration-200 ${
                  active() ? 'scale-110 text-primary' : 'group-hover:scale-110'
                }`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <Show when={item.count != null && item.count > 0}>
                <span
                  class={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors ${
                    active() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.count}
                </span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
