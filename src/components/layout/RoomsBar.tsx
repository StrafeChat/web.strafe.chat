import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { A, useLocation, useMatch } from '@solidjs/router';
import { UserArea } from './UserArea';
import { rooms, roomDisplayName } from '../../stores/rooms';
import { auth } from '../../stores/auth';

const PlusIcon = () => (
  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface PaneButtonProps {
  href: string;
  active?: boolean;
  icon: string;
  label: string;
}

const PaneButton: Component<PaneButtonProps> = (props) => (
  <A
    href={props.href}
    class={`flex items-center gap-3 w-full min-w-0 px-2 py-2 rounded-md text-left transition-colors text-foreground hover:bg-accent hover:text-accent-foreground ${
      props.active ? 'bg-accent text-accent-foreground' : ''
    }`}
  >
    <div class="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center">
      <i class={`fa-solid ${props.icon} text-sm`} />
    </div>
    <span class="text-sm font-medium truncate min-w-0">{props.label}</span>
  </A>
);

interface ConvItemProps {
  name: string;
  active?: boolean;
  href?: string;
}

const ConvItem: Component<ConvItemProps> = (props) => {
  const base = 'flex items-center gap-3 w-full min-w-0 px-2 py-2 rounded-md text-left transition-colors text-foreground hover:bg-accent hover:text-accent-foreground';
  const active = props.active ? 'bg-accent text-accent-foreground' : '';
  const content = (
    <>
      <div class="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
        {props.name[0].toUpperCase()}
      </div>
      <span class="text-sm font-medium truncate min-w-0">{props.name}</span>
    </>
  );
  if (props.href) {
    return <A href={props.href} class={`${base} ${active}`}>{content}</A>;
  }
  return <button type="button" class={`${base} ${active}`}>{content}</button>;
};

export const RoomsBar: Component = () => {
  const location = useLocation();
  const roomMatch = useMatch(() => '/rooms/:roomId');
  const pathname = () => location.pathname;
  const currentUserId = () => auth.user?.id ?? '';
  const activeRoomId = () => roomMatch()?.params?.roomId;

  return (
    <aside class="w-[240px] shrink-0 flex flex-col bg-[hsl(0_0%_8%)] border-r border-border overflow-hidden hidden md:flex">
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        <div class="px-3 py-3 shrink-0">
          <h2 class="text-base font-semibold text-foreground mb-2 truncate">Private Messages</h2>
          <div class="flex flex-col gap-0.5">
            <PaneButton href="/" active={pathname() === '/'} icon="fa-house" label="Home" />
            <PaneButton href="/friends" active={pathname() === '/friends'} icon="fa-user-group" label="Friends" />
            <PaneButton href="/notes" active={pathname() === '/notes'} icon="fa-note-sticky" label="Notes" />
          </div>
        </div>
        <div class="flex-1 flex flex-col min-h-0 overflow-hidden py-2 px-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Conversations
            </h3>
            <button
              type="button"
              class="p-1 rounded shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="New DM"
            >
              <PlusIcon />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto min-h-0 space-y-0.5">
            <Show when={rooms.loading}>
              <div class="py-2 text-xs text-muted-foreground">Loading...</div>
            </Show>
            <Show when={!rooms.loading && rooms.rooms.length === 0}>
              <div class="py-2 text-xs text-muted-foreground">No conversations yet</div>
            </Show>
            <For each={rooms.rooms}>
              {(room) => (
                <ConvItem
                  name={roomDisplayName(room, currentUserId())}
                  href={`/rooms/${room.id}`}
                  active={activeRoomId() === room.id}
                />
              )}
            </For>
          </div>
        </div>
      </div>
      <UserArea />
    </aside>
  );
};
