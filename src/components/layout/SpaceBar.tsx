import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { A, useLocation, useMatch } from '@solidjs/router';
import { lastVisited } from '../../stores/lastVisited';
import { Tooltip } from '../ui/Tooltip';

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
    <span class="flex items-center justify-center w-full h-full">
      {props.initial}
    </span>
  );
  if (props.href) {
    return (
      <div class="group relative w-full flex items-center justify-center min-h-12">
        <Show
          when={props.active}
          fallback={
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
          }
        >
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
        </Show>
        <A href={props.href} class={`relative ${base} ${active} bg-primary/30 hover:bg-primary/40`}>
          {content}
        </A>
      </div>
    );
  }
  return (
    <div class="group relative w-full flex items-center justify-center min-h-12">
      <Show
        when={props.active}
        fallback={
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
        }
      >
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
      </Show>
      <button type="button" class={`relative ${base} ${active} bg-primary/30 hover:bg-primary/40`}>
        {content}
      </button>
    </div>
  );
};

export const SpaceBar: Component = () => {
  const location = useLocation();
  const spaceMatch = useMatch(() => '/s/:spaceId');
  const pathname = () => location.pathname;
  const isHomeAppActive = () => {
    const p = pathname();
    return p === '/' || p === '/friends' || p === '/notes' || p.startsWith('/rooms/');
  };
  const activeSpaceId = () => spaceMatch()?.params?.spaceId;
  return (
    <aside class="w-[72px] shrink-0 flex flex-col items-center py-3 gap-1 bg-[hsl(0_0%_7%)] border-r border-border overflow-y-auto">
      <Tooltip label="Private Messages">
        <div class="group relative w-full flex items-center justify-center min-h-12">
          <Show
            when={isHomeAppActive()}
            fallback={
              <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
            }
          >
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
          </Show>
          <A
            href={lastVisited.path()}
            class={`relative flex items-center justify-center size-12 transition-all duration-200 ${
              isHomeAppActive()
                ? 'text-foreground bg-primary/30 rounded-[16px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/20 rounded-[24px] hover:rounded-[16px]'
            }`}
          >
            <HomeIcon />
          </A>
        </div>
      </Tooltip>
      <Divider />
      <For each={PLACEHOLDER_SPACES}>
        {(s) => (
          <Tooltip label={s.name}>
            <SpaceIcon
              name={s.name}
              initial={s.initial}
              href={`/s/${s.id}`}
              active={activeSpaceId() === s.id}
            />
          </Tooltip>
        )}
      </For>
      <Divider />
      <Tooltip label="Add a space">
        <div class="group relative w-full flex items-center justify-center min-h-12">
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
          <button
            type="button"
            class="relative flex items-center justify-center size-12 rounded-[24px] text-muted-foreground hover:text-foreground hover:bg-primary/20 hover:rounded-[16px] transition-all duration-200"
          >
            <PlusIcon />
          </button>
        </div>
      </Tooltip>
    </aside>
  );
};
