import type { Component } from 'solid-js';
import { incomingFriendRequests } from '../../lib/mobileNotifications';
import { createSignal, For, Show } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { lastVisited } from '../../stores/lastVisited';
import { spaces, removeSpace } from '../../stores/spaces';
import { spaceMembers } from '../../stores/spaceMembers';
import { memberCanCreateInvite, memberCanManageSpace, memberCanManageRoles } from '../../lib/spacePermissions';
import { confirmDialog } from '../../stores/confirmDialog';
import { requestSpaceAction, type SpaceQuickAction } from '../../stores/spaceQuickActions';
import { lastSpaceRoom } from '../../stores/lastSpaceRoom';
import { Tooltip } from '../ui/Tooltip';
import { CreateSpaceModal } from '../CreateSpaceModal';
import { rooms } from '../../stores/rooms';
import { messages } from '../../stores/messages';
import { readState, getUnreadCountForDisplay } from '../../stores/readState';
import { auth } from '../../stores/auth';
import { appSpaceRail } from '../../theme/appChrome';
import { showContextMenu } from '../../stores/contextMenu';
import { ackAllSpaceRooms, leaveSpace } from '../../api/spaces';
import { t } from '../../i18n';

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

const Divider = () => <div class="w-8 h-px bg-border rounded-sm mx-auto my-1" />;

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
  /** Shown as a distinct red corner badge, taking priority over the plain unread pill - the Discord white-pill-vs-red-badge distinction. */
  mentionCount?: number;
  onContextMenu?: (e: MouseEvent) => void;
}

const SpaceIcon: Component<SpaceIconProps> = (props) => {
  const base =
    'flex items-center justify-center size-12 rounded-[24px] text-foreground font-semibold text-sm transition-all duration-200 hover:rounded-[16px] overflow-hidden';
  // Accessors, not consts: this component lives for the whole session inside <For>, so a
  // one-shot `const hasUnread = ...` froze whatever the counts were at creation. A space
  // that was unread at page load kept its dot and badge (reading "0") after everything was
  // read, and one that was clean at load never lit up at all - "indicators won't go away"
  // and "no indicator appears" were the same bug.
  const active = () => (props.active ? 'rounded-[16px]' : '');
  const hasUnread = () => (props.unreadCount ?? 0) > 0;
  const hasMention = () => (props.mentionCount ?? 0) > 0;
  const content = (
    <span class="relative flex items-center justify-center w-full h-full">
      {props.icon ? (
        <img src={props.icon} alt="" class="size-full min-w-full min-h-full object-cover" />
      ) : (
        <span class="flex items-center justify-center w-full h-full">{props.initial}</span>
      )}
      <Show when={hasMention()}>
        <span class="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1 ring-2 ring-background">
          {(props.mentionCount ?? 0) > 99 ? '99+' : props.mentionCount}
        </span>
      </Show>
    </span>
  );
  const dotClass = () =>
    hasUnread() && !props.active
      ? 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground pointer-events-none'
      : 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none';

  // One tree with a tracked <Show> for the link-vs-button choice, rather than two early
  // returns: a component body runs once, so `if (props.href) return ...` would pin the
  // element to whichever branch was taken at mount.
  return (
    <div class="group relative w-full flex items-center justify-center min-h-12">
      <Show when={props.active} fallback={<div class={dotClass()} />}>
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
      </Show>
      <Show
        when={props.href}
        fallback={
          <button type="button" class={`relative ${base} ${active()} bg-primary/30 hover:bg-primary/40`}>
            {content}
          </button>
        }
      >
        {(href) => (
          <A
            href={href()}
            class={`relative ${base} ${active()} bg-primary/30 hover:bg-primary/40`}
            onContextMenu={(e) => props.onContextMenu?.(e)}
          >
            {content}
          </A>
        )}
      </Show>
    </div>
  );
};

export const SpaceBar: Component = () => {
  const [showCreateSpace, setShowCreateSpace] = createSignal(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = () => location.pathname;
  const currentUserId = () => auth.user?.id ?? '';
  const activeRoomId = () => pathname().match(/^\/spaces\/[^/]+\/rooms\/([^/]+)/)?.[1] ?? null;

  const friendRequestCount = () => incomingFriendRequests().length;

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
    const fromSpaceMap = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
    const fromRoomsStore = rooms.rooms.filter((r) => r.space_id === spaceId).map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name ?? '',
      topic: r.topic,
      position: r.position ?? 0,
      parent_id: r.parent_id,
      last_message_id: r.last_message_id,
      last_read_message_id: r.last_read_message_id,
      mention_count: r.mention_count,
      created_at: r.created_at,
      updated_at: r.updated_at,
      space_id: r.space_id,
    }));
    const seen = new Set<string>();
    const roomList = [...fromSpaceMap, ...fromRoomsStore].filter((r) => {
      if (!r?.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    // The channel currently on screen is excluded, same as its own sidebar row: its cursor
    // is being advanced live by the viewport ack, and counting it here made the space icon
    // light up for the very channel you were reading during the ~half second before each
    // ack landed.
    const viewing = activeRoomId();
    let total = 0;
    for (const r of roomList) {
      if (r.type === 3 && r.id !== viewing) {
        const roomMeta = rooms.rooms.find((x) => x.id === r.id) ?? r;
        const list = messages.byRoom[r.id] ?? [];
        total += getUnreadCountForDisplay(r.id, { ...roomMeta, space_id: roomMeta.space_id ?? spaceId }, list, uid);
      }
    }
    return total;
  };

  /** Sum of the real per-room mention counters (room_mention_counts) across the space's text channels. */
  const spaceMentionCount = (spaceId: string): number => {
    if (!currentUserId()) return 0;
    const roomIds = new Set<string>();
    for (const r of spaces.spaceRoomsBySpaceId[spaceId] ?? []) {
      if (r.type === 3) roomIds.add(r.id);
    }
    for (const r of rooms.rooms) {
      if (r.space_id === spaceId && r.type === 3) roomIds.add(r.id);
    }
    let total = 0;
    for (const id of roomIds) {
      total += readState.byRoom[id]?.mentionCount ?? 0;
    }
    return total;
  };

  function openSpaceMenu(e: MouseEvent, spaceId: string) {
    const unread = spaceUnreadCount(spaceId) > 0 || spaceMentionCount(spaceId) > 0;
    const sp = spaces.spaces.find((s) => s.id === spaceId);
    const uid = auth.user?.id;
    const me = spaceMembers.bySpaceId[spaceId]?.find((m) => m.id === uid);
    const roles = sp?.roles;
    const canInvite = memberCanCreateInvite(sp, roles, me, uid);
    const canSettings =
      memberCanManageSpace(sp, roles, me, uid) || memberCanManageRoles(sp, roles, me, uid);
    const isOwner = !!sp && sp.owner_id === uid;

    // Invite/Settings modals live in that space's SpaceRoomsBar: flag the action and, if it's not
    // the space we're viewing, navigate there so its bar mounts and picks the request up.
    const openAction = (action: SpaceQuickAction) => {
      requestSpaceAction(spaceId, action);
      if (activeSpaceId() !== spaceId) navigate(`/spaces/${spaceId}`);
    };

    showContextMenu(e, [
      ...(canInvite
        ? [{ label: t('space.inviteMembers'), icon: 'fa-user-plus', onClick: () => openAction('invite') }]
        : []),
      ...(canSettings
        ? [{ label: t('space.settings'), icon: 'fa-sliders', onClick: () => openAction('settings') }]
        : []),
      {
        label: t('contextMenu.markSpaceAsRead'),
        icon: 'fa-check-double',
        disabled: !unread,
        onClick: () => {
          ackAllSpaceRooms(spaceId).catch((err) => console.error('Mark server as read failed:', err));
        },
      },
      {
        label: t('contextMenu.copySpaceId'),
        icon: 'fa-copy',
        onClick: () => navigator.clipboard.writeText(spaceId),
      },
      // The owner can't leave (they must transfer or delete); everyone else can.
      ...(sp && !isOwner
        ? [
            {
              label: t('space.leave'),
              icon: 'fa-right-from-bracket',
              danger: true,
              onClick: async () => {
                const ok = await confirmDialog({
                  title: t('space.leave'),
                  body: t('space.leaveConfirm', { name: sp.name ?? t('space.thisSpace') }),
                  confirmLabel: t('space.leave'),
                  tone: 'danger',
                  icon: 'fa-solid fa-right-from-bracket',
                });
                if (!ok) return;
                try {
                  await leaveSpace(spaceId);
                  removeSpace(spaceId);
                  if (activeSpaceId() === spaceId) navigate('/', { replace: true });
                } catch (err) {
                  console.error('Failed to leave space:', err);
                }
              },
            },
          ]
        : []),
    ]);
  }

  const isHomeAppActive = () => {
    const p = pathname();
    return p === '/' || p === '/friends' || p === '/notes' || p.startsWith('/rooms/');
  };
  const activeSpaceId = () => pathname().match(/^\/spaces\/([^/]+)/)?.[1] ?? null;
  // Always rendered: below md this is the left half of the swipe pager's nav panel, so it
  // has to stay mounted even while the conversation is on screen.
  return (
    <aside
      class={`flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-3 ${appSpaceRail}`}
    >
      <CreateSpaceModal open={showCreateSpace()} onClose={() => setShowCreateSpace(false)} />
      <Tooltip label={t('nav.privateMessages')}>
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
              <Show
                when={friendRequestCount() > 0}
                fallback={
                  <Show when={homeUnreadCount() > 0}>
                    <span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1">
                      {homeUnreadCount() > 99 ? '99+' : homeUnreadCount()}
                    </span>
                  </Show>
                }
              >
                <span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1" title={t('friends.pendingRequests', { count: friendRequestCount() })}>
                  {friendRequestCount() > 99 ? '99+' : friendRequestCount()}
                </span>
              </Show>
            </span>
          </A>
        </div>
      </Tooltip>
      <Divider />
      <For each={spaces.spaces}>
        {(s) => (
          <Tooltip label={s.name || t('space.unnamed')}>
            <SpaceIcon
              name={s.name || t('space.unnamed')}
              initial={spaceInitial(s)}
              icon={s.icon || undefined}
              href={(() => {
                const lastRoom = lastSpaceRoom.get(s.id);
                return lastRoom ? `/spaces/${s.id}/rooms/${lastRoom}` : `/spaces/${s.id}`;
              })()}
              active={activeSpaceId() === s.id}
              unreadCount={spaceUnreadCount(s.id)}
              mentionCount={spaceMentionCount(s.id)}
              onContextMenu={(e) => openSpaceMenu(e, s.id)}
            />
          </Tooltip>
        )}
      </For>
      <Divider />
      <Tooltip label={t('space.addSpace')}>
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
