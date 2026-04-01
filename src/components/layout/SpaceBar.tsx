import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { A, useLocation, useMatch } from '@solidjs/router';
import { lastVisited } from '../../stores/lastVisited';
import { spaces } from '../../stores/spaces';
import { lastSpaceRoom } from '../../stores/lastSpaceRoom';
import { Tooltip } from '../ui/Tooltip';
import { CreateSpaceModal } from '../CreateSpaceModal';
import { rooms } from '../../stores/rooms';
import { messages } from '../../stores/messages';
import { getUnreadCountForDisplay } from '../../stores/readState';
import { auth } from '../../stores/auth';
import { appSpaceRail } from '../../theme/appChrome';
import { isMdViewport, mobileNavFocus } from '../../stores/mobileShellLayout';

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

function spaceInitial(space: { name_acronym?: string; name?: string }): string {
  const s = space.name_acronym || space.name || '?';
  return s.slice(0, 2).toUpperCase();
}

interface SpaceIconProps {
  name: string;
  initial: string;
  icon?: string;
  active?: boolean;
  href?: string;
  unreadCount?: number;
}

const SpaceIcon: Component<SpaceIconProps> = (props) => {
  const base =
    'flex items-center justify-center size-12 rounded-[24px] text-foreground font-semibold text-sm transition-all duration-200 hover:rounded-[16px] overflow-hidden';
  const active = props.active ? 'rounded-[16px]' : '';
  const hasUnread = (props.unreadCount ?? 0) > 0;
  const content = props.icon ? (
    <img src={props.icon} alt="" class="size-full min-w-full min-h-full object-cover" />
  ) : (
    <span class="flex items-center justify-center w-full h-full">{props.initial}</span>
  );
  const dotClass =
  hasUnread && !props.active
    ? 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground pointer-events-none'
    : 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none';

  if (props.href) {
    return (
      <div class="group relative w-full flex items-center justify-center min-h-12">
        <Show when={props.active} fallback={<div class={dotClass} />}>
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
      <Show when={props.active} fallback={<div class={dotClass} />}>
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
      </Show>
      <button type="button" class={`relative ${base} ${active} bg-primary/30 hover:bg-primary/40`}>
        {content}
      </button>
    </div>
  );
};

export const SpaceBar: Component = () => {
  const [showCreateSpace, setShowCreateSpace] = createSignal(false);
  const location = useLocation();
  const spaceMatch = useMatch(() => '/spaces/:spaceId');
  const pathname = () => location.pathname;
  const currentUserId = () => auth.user?.id ?? '';

  const homeUnreadCount = () => {
    const uid = currentUserId();
    if (!uid) return 0;
    let total = 0;
    for (const room of rooms.rooms) {
      // Home icon only reflects PM / group PM unread, not spaces.
      if ((room.type === 1 || room.type === 2) && !room.space_id) {
        const list = messages.byRoom[room.id] ?? [];
        total += getUnreadCountForDisplay(room.id, room, list, uid);
      }
    }
    return total;
  };

  const spaceUnreadCount = (spaceId: string): number => {
    const uid = currentUserId();
    if (!uid) return 0;
    const roomList = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
    let total = 0;
    for (const r of roomList) {
      if (r.type === 3) {
        const list = messages.byRoom[r.id] ?? [];
        total += getUnreadCountForDisplay(r.id, r, list, uid);
      }
    }
    return total;
  };
  const isHomeAppActive = () => {
    const p = pathname();
    return p === '/' || p === '/friends' || p === '/notes' || p.startsWith('/rooms/');
  };
  const activeSpaceId = () => spaceMatch()?.params?.spaceId;
  return (
    <aside
      class={`w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-3 ${appSpaceRail} ${
        isMdViewport() || mobileNavFocus() === 'rails' ? 'flex' : 'hidden'
      }`}
    >
      <CreateSpaceModal open={showCreateSpace()} onClose={() => setShowCreateSpace(false)} />
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
            <span class="relative inline-flex items-center justify-center">
              <HomeIcon />
              <Show when={homeUnreadCount() > 0}>
                <span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1">
                  {homeUnreadCount() > 99 ? '99+' : homeUnreadCount()}
                </span>
              </Show>
            </span>
          </A>
        </div>
      </Tooltip>
      <Divider />
      <For each={spaces.spaces}>
        {(s) => (
          <Tooltip label={s.name || 'Unnamed'}>
            <SpaceIcon
              name={s.name || 'Unnamed'}
              initial={spaceInitial(s)}
              icon={s.icon || undefined}
              href={(() => {
                const lastRoom = lastSpaceRoom.get(s.id);
                return lastRoom ? `/spaces/${s.id}/rooms/${lastRoom}` : `/spaces/${s.id}`;
              })()}
              active={activeSpaceId() === s.id}
              unreadCount={spaceUnreadCount(s.id)}
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
            onClick={() => setShowCreateSpace(true)}
          >
            <PlusIcon />
          </button>
        </div>
      </Tooltip>
    </aside>
  );
};
