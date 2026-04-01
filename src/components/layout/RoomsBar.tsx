import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { A, useLocation, useMatch } from '@solidjs/router';
import { UserArea } from './UserArea';
import { CreateGroupModal } from '../CreateGroupModal';
import { rooms, roomDisplayName, isNotesRoom, sortRoomsByLastMessage } from '../../stores/rooms';
import { auth } from '../../stores/auth';
import { presence } from '../../stores/presence';
import { lastVisited } from '../../stores/lastVisited';
import { getUnreadCountForDisplay, setReadState } from '../../stores/readState';
import { messages } from '../../stores/messages';
import { PresenceDot } from '../PresenceDot';
import { showContextMenu } from '../../stores/contextMenu';
import { ackRoom, removeRoomParticipant } from '../../api/rooms';
import { removeRoom } from '../../stores/rooms';
import { useNavigate } from '@solidjs/router';
import { appChannelRail, appHeaderBar } from '../../theme/appChrome';
import { isMdViewport, mobileNavFocus } from '../../stores/mobileShellLayout';

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
    class={`flex min-w-0 w-full items-center gap-3 rounded-md px-2 py-2 text-start text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${
      props.active ? 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/20' : ''
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
  /** Optional subtitle (e.g. custom status or @username) */
  subtitle?: string;
  href?: string;
  roomId?: string;
  /** User ID for presence indicator (1:1 PMs) */
  presenceUserId?: string;
  /** Avatar URL for 1:1 PMs */
  avatar?: string | null;
  /** Group DM: show group icon instead of avatar */
  isGroup?: boolean;
  /** Unread count (0 = no badge) */
  unreadCount?: number;
  /** Right-click context menu */
  onContextMenu?: (e: MouseEvent) => void;
}

const ConvItem: Component<ConvItemProps> = (props) => {
  const base =
    'flex min-w-0 w-full items-center gap-3 rounded-md px-2 py-2 text-start text-foreground transition-colors hover:bg-accent hover:text-accent-foreground';
  const content = (
    <>
      <div class="relative shrink-0">
        <Show
          when={props.isGroup}
          fallback={
            props.avatar ? (
              <img
                src={props.avatar}
                alt=""
                class="size-8 rounded-full object-cover"
              />
            ) : (
              <div class="size-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {props.name[0].toUpperCase()}
              </div>
            )
          }
        >
          <div class="size-8 rounded-full bg-muted flex items-center justify-center">
            <i class="fa-solid fa-user-group text-sm text-muted-foreground" />
          </div>
        </Show>
        <Show when={props.presenceUserId}>
          <span class="absolute bottom-[-1px] right-[-1px]">
            <PresenceDot userId={props.presenceUserId!} class="size-3.25" />
          </span>
        </Show>
      </div>
      <div class="min-w-0 flex-1 flex flex-col justify-center py-0.5">
        <span class="text-sm font-medium truncate block">{props.name}</span>
        <Show when={props.subtitle}>
          <span class="text-xs text-muted-foreground truncate block">{props.subtitle}</span>
        </Show>
      </div>
      <Show when={(props.unreadCount ?? 0) > 0}>
        <span class="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5">
          {(props.unreadCount ?? 0) > 99 ? '99+' : props.unreadCount}
        </span>
      </Show>
    </>
  );
  const contextMenu = props.onContextMenu;
  if (props.href) {
    return (
      <A
        href={props.href}
        end
        class={base}
        activeClass="bg-primary/15 text-foreground ring-1 ring-inset ring-primary/20"
        onContextMenu={contextMenu}
      >
        {content}
      </A>
    );
  }
  return (
    <button type="button" class={base} onContextMenu={contextMenu}>
      {content}
    </button>
  );
};

export const RoomsBar: Component = () => {
  const navigate = useNavigate();
  const [showCreateGroup, setShowCreateGroup] = createSignal(false);
  const location = useLocation();
  const roomMatch = useMatch(() => '/rooms/:roomId');
  const pathname = () => location.pathname;
  const currentUserId = () => auth.user?.id ?? '';
  const activeRoomId = () => roomMatch()?.params?.roomId;
  const activeRoom = () => rooms.rooms.find((r) => r.id === activeRoomId());
  const isNotesActive = () =>
    pathname() === '/notes' || !!(activeRoomId() && activeRoom() && isNotesRoom(activeRoom()!, currentUserId()));

  const conversationRooms = () =>
    sortRoomsByLastMessage(
      rooms.rooms.filter(
        (r) =>
          // Only show 1:1 and group PMs here, never space channels.
          (r.type === 1 || r.type === 2) &&
          !r.space_id &&
          !isNotesRoom(r, currentUserId())
      )
    );

  async function handleLeaveGroup(roomId: string) {
    const uid = currentUserId();
    if (!uid) return;
    try {
      await removeRoomParticipant(roomId, uid);
      removeRoom(roomId);
      if (activeRoomId() === roomId) navigate('/');
    } catch (err) {
      console.error('Leave group failed:', err);
    }
  }

  return (
    <aside
      class={`w-[240px] shrink-0 flex-col overflow-hidden ${appChannelRail} ${
        isMdViewport() || mobileNavFocus() === 'rails' ? 'flex' : 'hidden'
      }`}
    >
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        {/* Match RoomHeader / SpaceRoomsBar: h-12 + border-b separates header from content */}
        <div class={`flex h-12 shrink-0 items-center px-3 ${appHeaderBar}`}>
          <h1 class="text-base font-semibold text-foreground truncate">Private Messages</h1>
        </div>
        <div class="px-3 py-2 shrink-0">
          <div class="flex flex-col gap-0.5">
            <PaneButton href="/" active={pathname() === '/'} icon="fa-house" label="Home" />
            <PaneButton href="/friends" active={pathname() === '/friends'} icon="fa-user-group" label="Friends" />
            <PaneButton href="/notes" active={isNotesActive()} icon="fa-note-sticky" label="Notes" />
          </div>
        </div>
        <div class="flex-1 flex flex-col min-h-0 overflow-hidden py-2 px-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
              Conversations
            </h3>
            <button
              type="button"
              class="size-8 inline-flex items-center justify-center rounded shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="New group"
              onClick={() => setShowCreateGroup(true)}
            >
              <PlusIcon />
            </button>
          </div>
          <CreateGroupModal open={showCreateGroup()} onClose={() => setShowCreateGroup(false)} />
          <div class="flex-1 overflow-y-auto min-h-0 space-y-0.5">
            <Show when={rooms.loading}>
              <div class="py-2 text-xs text-muted-foreground">Loading...</div>
            </Show>
            <Show when={!rooms.loading && conversationRooms().length === 0}>
              <div class="py-2 text-xs text-muted-foreground">No conversations yet</div>
            </Show>
            <For each={conversationRooms()}>
              {(room) => {
                const otherParticipant = () =>
                  room.participants?.find((p) => p.id !== currentUserId());
                const isGroup = () => room.type === 2;
                const avatar = () =>
                  isGroup() ? null : otherParticipant()?.avatar;
                const roomMsgList = () => messages.byRoom[room.id] ?? [];
                const unreadCount = () => {
                  if (activeRoomId() === room.id) return 0;
                  const list = roomMsgList();
                  return getUnreadCountForDisplay(room.id, room, list, currentUserId());
                };
                const lastMsgId = () => {
                  const list = roomMsgList();
                  const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
                  if (snowflakes.length === 0) return room.last_message_id ?? null;
                  const latest = snowflakes.reduce((a, b) =>
                    BigInt(b.id) > BigInt(a.id) ? b : a
                  );
                  return latest.id;
                };
                const subtitle = () => {
                  const other = otherParticipant();
                  if (!other) return undefined;
                  return presence.byUser[other.id]?.custom_status ?? other.presence?.custom_status ?? undefined;
                };
                return (
                  <ConvItem
                    name={roomDisplayName(room, currentUserId())}
                    subtitle={!isGroup() ? subtitle() : undefined}
                    href={`/rooms/${room.id}`}
                    roomId={room.id}
                    presenceUserId={isGroup() ? undefined : otherParticipant()?.id}
                    avatar={avatar()}
                    isGroup={isGroup()}
                    unreadCount={unreadCount()}
                    onContextMenu={(e) => {
                      const msgId = lastMsgId();
                      showContextMenu(e, [
                        ...(msgId && unreadCount() > 0
                          ? [{
                              label: 'Mark as read',
                              icon: 'fa-check-double',
                              onClick: () => {
                                setReadState('byRoom', room.id, {
                                  lastReadMessageId: msgId,
                                  mentionCount: 0,
                                });
                                ackRoom(room.id, msgId).catch(() => {});
                              },
                            }]
                          : []),
                        ...(isGroup()
                          ? [{
                              label: 'Leave group',
                              icon: 'fa-right-from-bracket',
                              danger: true,
                              onClick: () => handleLeaveGroup(room.id),
                            }]
                          : []),
                        {
                          label: 'Copy room ID',
                          icon: 'fa-copy',
                          onClick: () => navigator.clipboard.writeText(room.id),
                        },
                      ]);
                    }}
                  />
                );
              }}
            </For>
          </div>
        </div>
      </div>
      <UserArea />
    </aside>
  );
};
