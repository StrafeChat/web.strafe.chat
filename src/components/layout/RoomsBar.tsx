import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { A, useLocation, useMatch} from '@solidjs/router';
import { UserArea } from './UserArea';
import { VoiceDock } from '../voice/VoiceDock';
import { CreateGroupModal } from '../CreateGroupModal';
import { rooms, roomDisplayName, isNotesRoom, sortRoomsByLastMessage } from '../../stores/rooms';
import { auth } from '../../stores/auth';
import { presence, isPresentStatus } from '../../stores/presence';
import { getUnreadCountForDisplay, ackRoomOptimistic } from '../../stores/readState';
import { messages } from '../../stores/messages';
import { PresenceDot } from '../PresenceDot';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { showContextMenu } from '../../stores/contextMenu';
import { removeRoomParticipant } from '../../api/rooms';
import { removeRoom } from '../../stores/rooms';
import { useNavigate } from '@solidjs/router';
import {
  appChannelRail,
  appPageHeader,
  appPageTitle,
  appListRow,
  appListRowActive,
  appListRowIdle,
  appSectionLabel,
} from '../../theme/appChrome';
import { isMdViewport, openMobileContent } from '../../stores/mobileShellLayout';
import { isRoomMuted, muteRoom, unmuteRoom } from '../../lib/roomNotify';
import { incomingFriendRequests } from '../../lib/mobileNotifications';
import { IconButton } from '../ui/IconButton';
import { t } from '../../i18n';
import { BotTag } from '../BotTag';

interface PaneButtonProps {
  href: string;
  active?: boolean;
  icon: string;
  label: string;
  /** Red count badge (e.g. incoming friend requests). 0 hides it. */
  badge?: number;
}

/**
 * A plain anchor rather than the router's `A`: a click handler passed through `A` never
 * reached the element here (the anchor ended up with no delegated handler at all), and
 * this row must do two things on a phone - navigate, and bring the content panel on
 * screen even when the path did not change. Modifier and middle clicks are left to the
 * browser, which is what the real href is for.
 */
const PaneButton: Component<PaneButtonProps> = (props) => {
  const navigate = useNavigate();
  return (
    <a
      href={props.href}
      aria-current={props.active ? 'page' : undefined}
      class={`${appListRow} ${props.active ? appListRowActive : appListRowIdle}`}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(props.href);
        if (!isMdViewport()) openMobileContent();
      }}
    >
      <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <i class={`fa-solid ${props.icon} text-sm`} aria-hidden="true" />
      </div>
      <span class="min-w-0 truncate text-sm font-medium">{props.label}</span>
      <Show when={(props.badge ?? 0) > 0}>
        <span class="ms-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-5 text-destructive-foreground">
          {(props.badge ?? 0) > 99 ? '99+' : props.badge}
        </span>
      </Show>
    </a>
  );
};

interface ConvItemProps {
  name: string;
  /** 1:1 PM with a bot: BOT tag after the name. */
  bot?: boolean;
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
  muted?: boolean;
  /** Right-click context menu */
  onContextMenu?: (e: MouseEvent) => void;
}

const ConvItem: Component<ConvItemProps> = (props) => {
  const base = `${appListRow} ${appListRowIdle}`;
  const content = (
    <>
      <div class="relative shrink-0">
        <Show
          when={props.isGroup}
          fallback={<MessageAvatar name={props.name} avatar={props.avatar ?? undefined} class="size-8 text-[13px]" />}
        >
          <div class="flex size-8 items-center justify-center rounded-full bg-muted">
            <i class="fa-solid fa-user-group text-sm text-muted-foreground" aria-hidden="true" />
          </div>
        </Show>
        <Show when={props.presenceUserId}>
          <span class="absolute -bottom-px -right-px">
            <PresenceDot userId={props.presenceUserId!} class="size-3.25" />
          </span>
        </Show>
      </div>
      <div class="flex min-w-0 flex-1 flex-col justify-center py-0.5">
        <span
          class={`flex items-center gap-1.5 truncate text-sm ${
            (props.unreadCount ?? 0) > 0 && !props.muted ? 'font-semibold text-foreground' : 'font-medium'
          }`}
        >
          <span class="min-w-0 truncate">{props.name}</span>
          <BotTag bot={props.bot} size="xs" class="ms-0" />
          <Show when={props.muted}>
            <i class="fa-solid fa-bell-slash shrink-0 text-[10px] text-muted-foreground/70" aria-hidden="true" />
          </Show>
        </span>
        <Show when={props.subtitle}>
          <span class="block truncate text-xs text-muted-foreground">{props.subtitle}</span>
        </Show>
      </div>
      <Show when={(props.unreadCount ?? 0) > 0 && !props.muted}>
        <span class="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {(props.unreadCount ?? 0) > 99 ? '99+' : props.unreadCount}
        </span>
      </Show>
      <Show when={(props.unreadCount ?? 0) > 0 && props.muted}>
        <span class="size-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden="true" />
      </Show>
    </>
  );
  // A tracked <Show> rather than `if (props.href) return ...`: a component body runs once,
  // so an early return there would pin the element to whichever branch was taken at mount.
  return (
    <Show
      when={props.href}
      fallback={
        <button type="button" class={base} onContextMenu={(e) => props.onContextMenu?.(e)}>
          {content}
        </button>
      }
    >
      {(href) => (
        <A href={href()} end class={base} activeClass={appListRowActive} onContextMenu={(e) => props.onContextMenu?.(e)}>
          {content}
        </A>
      )}
    </Show>
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
      class={`flex w-[calc(100vw-72px)] shrink-0 flex-col overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:w-[240px] md:pb-0 ${appChannelRail}`}
    >
      <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {/* Match RoomHeader / SpaceRoomsBar: h-12 + border-b separates header from content */}
        <div class={`${appPageHeader}`}>
          <h1 class={`truncate ${appPageTitle}`}>{t('nav.privateMessages')}</h1>
        </div>
        {/* One scroll region for the whole rail below the title: Home/Friends/Notes scroll
            away with the conversation list instead of staying pinned above their own
            scrollbar, which is what a phone-height list needs and what Discord does. */}
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          <div class="flex flex-col gap-0.5">
            <PaneButton href="/" active={pathname() === '/'} icon="fa-house" label={t('nav.home')} />
            <PaneButton href="/friends" active={pathname() === '/friends'} icon="fa-user-group" label={t('nav.friends')} badge={incomingFriendRequests().length} />
            <PaneButton href="/notes" active={isNotesActive()} icon="fa-note-sticky" label={t('nav.notes')} />
          </div>
          <div class="pt-3">
            <div class="mb-1 flex items-center justify-between ps-2">
              <h3 class={`truncate ${appSectionLabel}`}>{t('nav.conversations')}</h3>
              <IconButton size="sm" icon="fa-solid fa-plus" label={t('nav.newGroup')} onClick={() => setShowCreateGroup(true)} />
            </div>
            <CreateGroupModal open={showCreateGroup()} onClose={() => setShowCreateGroup(false)} />
            <div class="space-y-0.5">
            <Show when={rooms.loading}>
              <div class="px-2 py-2 text-xs text-muted-foreground">{t('common.loading')}</div>
            </Show>
            <Show when={!rooms.loading && conversationRooms().length === 0}>
              <div class="px-2 py-2 text-xs text-muted-foreground">{t('nav.noConversations')}</div>
            </Show>
            <For each={conversationRooms()}>
              {(room) => {
                const otherParticipant = () => room.participants?.find((p) => p.id !== currentUserId());
                const isGroup = () => room.type === 2;
                const avatar = () => (isGroup() ? null : otherParticipant()?.avatar);
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
                  const latest = snowflakes.reduce((a, b) => (BigInt(b.id) > BigInt(a.id) ? b : a));
                  return latest.id;
                };
                const subtitle = () => {
                  const other = otherParticipant();
                  if (!other) return undefined;
                  // Only while they're present: a custom status under an offline user reads
                  // as if they're around (the space members list already hides it offline).
                  const st = presence.byUser[other.id]?.status ?? other.presence?.status;
                  if (!isPresentStatus(st)) return undefined;
                  return presence.byUser[other.id]?.custom_status ?? other.presence?.custom_status ?? undefined;
                };
                return (
                  <ConvItem
                    name={roomDisplayName(room, currentUserId())}
                    bot={!isGroup() && otherParticipant()?.bot === true}
                    subtitle={!isGroup() ? subtitle() : undefined}
                    href={`/rooms/${room.id}`}
                    roomId={room.id}
                    presenceUserId={isGroup() ? undefined : otherParticipant()?.id}
                    avatar={avatar()}
                    isGroup={isGroup()}
                    unreadCount={unreadCount()}
                    muted={isRoomMuted(room)}
                    onContextMenu={(e) => {
                      const msgId = lastMsgId();
                      showContextMenu(e, [
                        ...(msgId && unreadCount() > 0
                          ? [
                              {
                                label: t('contextMenu.markAsRead'),
                                icon: 'fa-check-double',
                                onClick: () => ackRoomOptimistic(room.id, msgId),
                              },
                            ]
                          : []),
                        {
                          label: isRoomMuted(room) ? t('contextMenu.unmute') : t('contextMenu.mute'),
                          icon: isRoomMuted(room) ? 'fa-bell' : 'fa-bell-slash',
                          onClick: () =>
                            void (isRoomMuted(room) ? unmuteRoom(room.id) : muteRoom(room.id, null)).catch((err) =>
                              console.error('Toggle mute failed:', err)
                            ),
                        },
                        ...(isGroup()
                          ? [
                              {
                                label: t('contextMenu.leaveGroup'),
                                icon: 'fa-right-from-bracket',
                                danger: true,
                                onClick: () => handleLeaveGroup(room.id),
                              },
                            ]
                          : []),
                        {
                          label: t('contextMenu.copyRoomId'),
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
      </div>
      {/* The mobile You tab replaces this dock, so it is desktop-only below md. */}
      <Show when={isMdViewport()}>
        <VoiceDock variant="rail" />
        <UserArea />
      </Show>
    </aside>
  );
};
