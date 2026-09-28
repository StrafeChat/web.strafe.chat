import { For } from 'solid-js';
import type { JSX } from 'solid-js';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  disabled?: boolean;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  items: TabItem<T>[];
  size?: 'sm' | 'md';
  class?: string;
  'aria-label'?: string;
}

/** Segmented pill control - the one tab style used for page tabs and in-modal sub-tabs. */
export function Tabs<T extends string>(props: TabsProps<T>): JSX.Element {
  const size = () => props.size ?? 'md';
  return (
    <div
      role="tablist"
      aria-label={props['aria-label']}
      class={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted/40 p-0.5 ${props.class ?? ''}`}
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.value === item.id}
            disabled={item.disabled}
            class={`shrink-0 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 ${
              size() === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${
              props.value === item.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
            }`}
            onClick={() => {
              if (!item.disabled) props.onChange(item.id);
            }}
          >
            {item.label}
          </button>
        )}
      </For>
    </div>
  );
}
