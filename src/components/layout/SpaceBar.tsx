import type { Component } from 'solid-js';
import { For } from 'solid-js';
import { A } from '@solidjs/router';

const iconSize = 24;

const HomeIcon = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PlusIcon = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Divider = () => <div class="w-8 h-px bg-border rounded-full mx-auto my-1" />;

// Placeholder spaces – will be loaded from API
const PLACEHOLDER_SPACES = [
  { id: '1', name: 'General', initial: 'G' },
  { id: '2', name: 'Dev', initial: 'D' },
];

interface SpaceIconProps {
  name: string;
  initial: string;
  active?: boolean;
  href?: string;
}

const SpaceIcon: Component<SpaceIconProps> = (props) => {
  const base = 'flex items-center justify-center size-12 rounded-[24px] text-foreground font-semibold text-sm transition-all duration-200 hover:rounded-[16px]';
  const active = props.active ? 'rounded-[16px]' : '';
  const content = (
    <span class="flex items-center justify-center w-full h-full" title={props.name}>
      {props.initial}
    </span>
  );
  if (props.href) {
    return (
      <A href={props.href} class={`${base} ${active} bg-primary/30 hover:bg-primary/40`}>
        {content}
      </A>
    );
  }
  return (
    <button type="button" class={`${base} ${active} bg-primary/30 hover:bg-primary/40`}>
      {content}
    </button>
  );
};

export const SpaceBar: Component = () => {
  return (
    <aside class="w-[72px] shrink-0 flex flex-col items-center py-3 gap-1 bg-[hsl(0_0%_7%)] border-r border-border overflow-y-auto">
      <A
        href="/"
        class="flex items-center justify-center size-12 rounded-[24px] text-muted-foreground hover:text-foreground hover:bg-primary/20 hover:rounded-[16px] transition-all duration-200"
        title="Home"
      >
        <HomeIcon />
      </A>
      <Divider />
      <For each={PLACEHOLDER_SPACES}>
        {(s) => <SpaceIcon name={s.name} initial={s.initial} href={`/s/${s.id}`} />}
      </For>
      <Divider />
      <button
        type="button"
        class="flex items-center justify-center size-12 rounded-[24px] text-muted-foreground hover:text-foreground hover:bg-primary/20 hover:rounded-[16px] transition-all duration-200"
        title="Add a space"
      >
        <PlusIcon />
      </button>
    </aside>
  );
};
