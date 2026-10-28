import type { Space, SpaceRoom } from '../../api/spaces';
import type { Component } from 'solid-js';
import { incomingFriendRequests } from '../../lib/mobileNotifications';
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import { lastVisited } from '../../stores/lastVisited';
import { spaces, removeSpace } from '../../stores/spaces';
import { spaceMembers } from '../../stores/spaceMembers';
import { memberCanCreateInvite, memberCanManageSpace, memberCanManageRoles, memberCanManageNicknames } from '../../lib/spacePermissions';
import { confirmDialog } from '../../stores/confirmDialog';
import { requestSpaceAction, type SpaceQuickAction } from '../../stores/spaceQuickActions';
import { openUserSettings } from '../../stores/userSettingsModal';
import { lastSpaceRoom } from '../../stores/lastSpaceRoom';
import { orderSpacesByPreference } from '../../stores/spaceOrder';
import { createSpaceReorder } from './spaceRail/createSpaceReorder';
import { Tooltip } from '../ui/Tooltip';
import { CreateSpaceModal } from '../CreateSpaceModal';
import { SpaceFolderSettingsModal } from '../SpaceFolderSettingsModal';
import { rooms, roomDisplayName, isNotesRoom, sortRoomsByLastMessage } from '../../stores/rooms';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { PresenceDot } from '../PresenceDot';
import { isRoomMuted } from '../../lib/roomNotify';
import { messages } from '../../stores/messages';
import { readState, getUnreadCountForDisplay } from '../../stores/readState';
import { auth } from '../../stores/auth';
import { appSpaceRail } from '../../theme/appChrome';
import { showContextMenu } from '../../stores/contextMenu';
import { ackAllSpaceRooms, leaveSpace } from '../../api/spaces';
import { t } from '../../i18n';
import { spaceFolders, DEFAULT_FOLDER_COLOR, type SpaceFolder } from '../../stores/spaceFolders';
import { spaceRailOrder } from '../../stores/spaceRailOrder';

const iconSize = 24;

const HomeIcon = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PlusIcon = () => (
  <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Divider = () => <div class="w-8 h-px bg-border rounded-sm mx-auto my-1" />;

function spaceInitial(space: { name_acronym?: string; name?: string }): string {
  const s = space.name_acronym || space.name || '?';
  return s.slice(0, 2).toUpperCase();
}

function folderSurfaceColor(color: string): string {
  const value = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/i.test(value)) return 'rgba(255, 255, 255, 0.06)';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${Math.round(r * 0.5)}, ${Math.round(g * 0.5)}, ${Math.round(b * 0.5)}, 0.3)`;
}

type DropTarget =
  | { kind: 'folder'; id: string; index?: number }
  | { kind: 'space'; id: string }
  | { kind: 'ungroup'; index: number };
type RailItem = SpaceFolder | Space;

function isFolderItem(item: RailItem): item is SpaceFolder {
  return 'spaceIds' in item;
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
  dropId?: string;
  railIndicator?: boolean;
  dropActive?: boolean;
  onContextMenu?: (e: MouseEvent) => void;
}

const SpaceIcon: Component<SpaceIconProps> = (props) => {
  // No overflow-hidden here: the icon image is clipped by an inner layer (below) so the
  // corner mention badge, which sits just outside the squircle, isn't sliced into a half
  // circle. The clip layer follows this element's animated radius via rounded-[inherit].
  const base =
    'flex items-center justify-center size-12 rounded-[24px] text-foreground font-semibold text-sm transition-all duration-200 hover:rounded-[16px]';
  // Accessors, not consts: this component lives for the whole session inside <For>, so a
  // one-shot `const hasUnread = ...` froze whatever the counts were at creation. A space
  // that was unread at page load kept its dot and badge (reading "0") after everything was
  // read, and one that was clean at load never lit up at all - "indicators won't go away"
  // and "no indicator appears" were the same bug.
  const active = () => (props.active ? 'rounded-[16px]' : '');
  const dropRing = () => (props.dropActive ? 'ring-2 ring-primary/35' : '');
  const hasUnread = () => (props.unreadCount ?? 0) > 0;
  const hasMention = () => (props.mentionCount ?? 0) > 0;
  // The icon is a picture with alt="" (or two letters) and the name lives only in the wrapping
  // tooltip, which assistive tech does not read - so name the control itself, count included.
  const ariaLabel = () =>
    hasMention() ? t('nav.railItemMentions', { name: props.name, count: props.mentionCount ?? 0 }) : props.name;
  const content = (
    <>
      {/* Clip layer: rounds the icon image to the squircle, following the button's animated
          radius. Kept separate from the badge so overflow-hidden never touches the badge. */}
      <span class="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
        {props.icon ? (
          <img src={props.icon} alt="" class="size-full object-cover" draggable={false} />
        ) : (
          <span>{props.initial}</span>
        )}
      </span>
      <Show when={hasMention()}>
        <span class="absolute -top-1 -right-1 z-10 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1 ring-2 ring-background">
          {(props.mentionCount ?? 0) > 99 ? '99+' : props.mentionCount}
        </span>
      </Show>
    </>
  );
  const indicatorLeft = () => (props.railIndicator ? '-left-3' : 'left-0');
  const dotClass = () =>
    hasUnread() && !props.active
      ? `absolute ${indicatorLeft()} top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground pointer-events-none`
      : `absolute ${indicatorLeft()} top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none`;

  // One tree with a tracked <Show> for the link-vs-button choice, rather than two early
  // returns: a component body runs once, so `if (props.href) return ...` would pin the
  // element to whichever branch was taken at mount.
  return (
    <div class="group relative w-full flex items-center justify-center min-h-12">
      <Show when={props.active} fallback={<div class={dotClass()} />}>
        <div class={`absolute ${indicatorLeft()} top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none`} />
      </Show>
      <Show
        when={props.href}
        fallback={
          <button
            type="button"
            aria-label={ariaLabel()}
            data-space-drop-id={props.dropId}
            class={`relative ${base} ${active()} ${dropRing()} bg-primary/30 hover:bg-primary/40`}
          >
            {content}
          </button>
        }
      >
        {(href) => (
          <A
            href={href()}
            aria-label={ariaLabel()}
            draggable={false}
            data-space-drop-id={props.dropId}
            class={`relative ${base} ${active()} ${dropRing()} bg-primary/30 hover:bg-primary/40`}
            onContextMenu={(e) => props.onContextMenu?.(e)}
          >
            {content}
          </A>
        )}
      </Show>
    </div>
  );
};

interface DmRailIconProps {
  room: (typeof rooms.rooms)[number];
  active: boolean;
  unread: number;
}

/** A PM / group-DM avatar in the spaces rail, below the home button (Discord-style). Shows a
 * white edge pill for unread/hover/active and a red count badge, mirroring SpaceIcon. */
const DmRailIcon: Component<DmRailIconProps> = (props) => {
  const uid = () => auth.user?.id ?? '';
  const isGroup = () => props.room.type === 2;
  const other = () => props.room.participants?.find((p) => p.id !== uid());
  const name = () => roomDisplayName(props.room, uid());
  const hasUnread = () => props.unread > 0;
  // Same as SpaceIcon: the avatar has alt="" and the tooltip is not read out.
  const ariaLabel = () => (hasUnread() ? t('nav.railItemUnread', { name: name(), count: props.unread }) : name());
  const base = 'relative flex items-center justify-center size-12 rounded-full transition-all duration-200';
  const dotClass = () =>
    hasUnread() && !props.active
      ? 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground pointer-events-none'
      : 'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none';
  return (
    <div class="group relative w-full flex items-center justify-center min-h-12">
      <Show when={props.active} fallback={<div class={dotClass()} />}>
        <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
      </Show>
      <A
        href={`/rooms/${props.room.id}`}
        aria-label={ariaLabel()}
        class={`${base} ${props.active ? 'ring-2 ring-primary/50' : 'hover:ring-2 hover:ring-primary/30'}`}
      >
        <Show
          when={isGroup()}
          fallback={<MessageAvatar name={name()} avatar={other()?.avatar ?? undefined} class="size-12 text-base" />}
        >
          <div class="flex size-12 items-center justify-center rounded-full bg-muted ring-1 ring-border/50">
            <i class="fa-solid fa-user-group text-base text-muted-foreground" aria-hidden="true" />
          </div>
        </Show>
        <Show when={!isGroup() && other()?.id}>
          <span class="absolute -bottom-0.5 -right-0.5">
            <PresenceDot userId={other()!.id} class="size-3.5" />
          </span>
        </Show>
        <Show when={hasUnread()}>
          <span class="absolute -top-1 -right-1 z-10 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1 ring-2 ring-background">
            {props.unread > 99 ? '99+' : props.unread}
          </span>
        </Show>
      </A>
    </div>
  );
};

export const SpaceBar: Component = () => {
  const [showCreateSpace, setShowCreateSpace] = createSignal(false);
  const [showFolderSettings, setShowFolderSettings] = createSignal(false);
  const [editingFolderId, setEditingFolderId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<DropTarget | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const pathname = () => location.pathname;
  const currentUserId = () => auth.user?.id ?? '';
  const activeRoomId = () => pathname().match(/^\/spaces\/[^/]+\/rooms\/([^/]+)/)?.[1] ?? null;
  const activeSpaceId = () => pathname().match(/^\/spaces\/([^/]+)/)?.[1] ?? null;

  const [railEl, setRailEl] = createSignal<HTMLElement>();
  let hasMountedRail = false;
  onMount(() => {
    hasMountedRail = true;
  });
  const orderedSpaces = createMemo(() => orderSpacesByPreference(spaces.spaces));

  const folders = createMemo(() => spaceFolders.all());
  const spacesInFolders = createMemo(() => {
    const set = new Set<string>();
    for (const f of folders()) {
      for (const id of f.spaceIds) set.add(id);
    }
    return set;
  });
  const ungroupedSpaces = createMemo(() => orderedSpaces().filter((s) => !spacesInFolders().has(s.id)));

  const railItems = createMemo<RailItem[]>(() => {
    const folderMap = new Map(folders().map((f) => [f.id, f]));
    const spaceMap = new Map(ungroupedSpaces().map((s) => [s.id, s]));
    const ordered: RailItem[] = [];
    const known = spaceRailOrder.ids();
    const hasFolderOrder = folders().some((f) => known.includes(f.id));
    if (known.length > 0 && (folders().length === 0 || hasFolderOrder)) {
      for (const id of known) {
        const folder = folderMap.get(id);
        if (folder) {
          ordered.push(folder);
          folderMap.delete(id);
          continue;
        }
        const space = spaceMap.get(id);
        if (space) {
          ordered.push(space);
          spaceMap.delete(id);
        }
      }
    } else {
      for (const folder of [...folderMap.values()].sort((a, b) => a.order - b.order)) {
        ordered.push(folder);
        folderMap.delete(folder.id);
      }
      for (const id of known) {
        const space = spaceMap.get(id);
        if (space) {
          ordered.push(space);
          spaceMap.delete(id);
        }
      }
    }
    for (const folder of [...folderMap.values()].sort((a, b) => a.order - b.order)) {
      ordered.push(folder);
    }
    for (const space of ungroupedSpaces()) {
      if (spaceMap.has(space.id)) ordered.push(space);
    }
    return ordered;
  });

  const railId = (item: RailItem): string => item.id;

  function placeNewFolder(folderId: string, index: number) {
    const ids = railItems()
      .map(railId)
      .filter((id) => id !== folderId);
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, folderId);
    spaceRailOrder.set(ids);
  }

  function focusNewFolder(folderId: string) {
    placeNewFolder(folderId, 0);
    requestAnimationFrame(() => {
      railEl()?.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(folderId)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  const ungroupIndex = () => {
    const target = dropTarget();
    return target?.kind === 'ungroup' ? target.index : null;
  };

  function topLevelInsertIndex(y: number): number {
    const container = railEl();
    const items = railItems();
    if (!container) return items.length;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const el = container.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(railId(item))}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return items.length;
  }

  function resolveDropTarget(x: number, y: number, draggedId: string): DropTarget | null {
    if (spaceFolders.get(draggedId)) return null;
    const sourceFolder = spaceFolders.folderForSpace(draggedId);
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const folderId = el.closest<HTMLElement>('[data-folder-drop-id]')?.dataset.folderDropId;
    if (folderId) {
      const folder = spaceFolders.get(folderId);
      if (!folder || folder.spaceIds.includes(draggedId)) return null;
      const targetEl = el.closest<HTMLElement>('[data-space-drop-id]');
      const targetId = targetEl?.dataset.spaceDropId;
      const targetIndex = targetId ? folder.spaceIds.indexOf(targetId) : -1;
      if (targetEl && targetIndex >= 0) {
        const r = targetEl.getBoundingClientRect();
        return { kind: 'folder', id: folderId, index: targetIndex + (y >= r.top + r.height / 2 ? 1 : 0) };
      }
      return { kind: 'folder', id: folderId };
    }
    const spaceId = el.closest<HTMLElement>('[data-space-drop-id]')?.dataset.spaceDropId;
    if (spaceId) {
      if (spaceId === draggedId) return null;
      const spaceFolder = spaceFolders.folderForSpace(spaceId);
      if (spaceFolder) {
        if (sourceFolder?.id === spaceFolder.id) return null;
        return { kind: 'folder', id: spaceFolder.id };
      }
      if (sourceFolder) return { kind: 'ungroup', index: topLevelInsertIndex(y) };
      return { kind: 'space', id: spaceId };
    }
    if (sourceFolder) {
      if (el.closest<HTMLElement>('[data-folder-id]')?.dataset.folderId === sourceFolder.id) return null;
      return { kind: 'ungroup', index: topLevelInsertIndex(y) };
    }
    return null;
  }

  function handleDragEnd(draggedId: string, cancelled: boolean) {
    const target = untrack(dropTarget);
    setDropTarget(null);
    if (cancelled || !target) return;
    if (target.kind === 'folder') {
      spaceFolders.setSpaceFolder(draggedId, target.id, target.index);
      return;
    }
    if (target.kind === 'ungroup') {
      const ids = railItems().map(railId).filter((id) => id !== draggedId);
      spaceFolders.setSpaceFolder(draggedId, null);
      ids.splice(Math.max(0, Math.min(target.index, ids.length)), 0, draggedId);
      spaceRailOrder.set(ids);
      return;
    }
    const orderBefore = railItems().map(railId);
    const targetIndex = orderBefore.indexOf(target.id);
    const removed = new Set([draggedId, target.id]);
    const insertAt = orderBefore.slice(0, Math.max(0, targetIndex)).filter((id) => !removed.has(id)).length;
    const folder = spaceFolders.create(t('space.folders.defaultName'), { spaceIds: [draggedId, target.id] });
    placeNewFolder(folder.id, insertAt);
  }

  const reorder = createSpaceReorder({
    container: () => railEl(),
    ids: (draggedId) => {
      if (draggedId) {
        const folder = spaceFolders.folderForSpace(draggedId);
        if (folder) return folder.spaceIds;
      }
      return railItems().map(railId);
    },
    onCommit: (ids, id) => {
      const folder = spaceFolders.folderForSpace(id);
      if (folder) {
        spaceFolders.reorderSpacesInFolder(folder.id, ids);
        return;
      }
      spaceRailOrder.set(ids);
    },
    onDragMove: ({ id, x, y }) => setDropTarget(resolveDropTarget(x, y, id)),
    onDragEnd: ({ id, cancelled }) => handleDragEnd(id, cancelled),
    shouldReorder: () => !dropTarget(),
    shouldCommit: () => !dropTarget(),
    unbounded: (id) => !!id && !!spaceFolders.folderForSpace(id),
  });

  createEffect(() => {
    if (!spaces.hydrated) return;
    const known = new Set(spaces.spaces.map((s) => s.id));
    if (known.size === 0) return;
    untrack(() => spaceFolders.prune(known));
  });

  const friendRequestCount = () => incomingFriendRequests().length;
  const activePmRoomId = () => pathname().match(/^\/rooms\/([^/]+)/)?.[1] ?? null;
  const dmUnread = (room: (typeof rooms.rooms)[number]) => {
    const uid = currentUserId();
    if (!uid) return 0;
    if (activePmRoomId() === room.id) return 0;
    const list = messages.byRoom[room.id] ?? [];
    return getUnreadCountForDisplay(room.id, room, list, uid);
  };
  const railDms = () =>
    sortRoomsByLastMessage(
      rooms.rooms.filter((r) => {
        if (!((r.type === 1 || r.type === 2) && !r.space_id)) return false;
        if (isNotesRoom(r, currentUserId())) return false;
        // Only unread DMs appear here; opening a PM (it becomes the active room, so
        // dmUnread returns 0) drops its avatar from the rail right away, and it stays
        // gone once the open conversation is marked read.
        return !isRoomMuted(r) && dmUnread(r) > 0;
      }),
    );

  const spaceUnreadCount = (spaceId: string): number => {
    const uid = currentUserId();
    if (!uid) return 0;
    const fromSpaceMap = spaces.spaceRoomsBySpaceId[spaceId] ?? [];
    const fromRoomsStore = rooms.rooms.filter((r) => r.space_id === spaceId).map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name ?? '',
      topic: r.topic,
      thread: undefined as SpaceRoom['thread'],
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
      // Threads count once joined (Discord: unjoined threads never light the space up).
      if ((r.type === 3 || (r.type === 6 && r.thread?.joined)) && r.id !== viewing) {
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
      if (r.type === 3 || (r.type === 6 && r.thread?.joined)) roomIds.add(r.id);
    }
    for (const r of rooms.rooms) {
      if (r.space_id === spaceId && (r.type === 3 || r.type === 6)) roomIds.add(r.id);
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
    // Same gate as the space header's Settings entry (SpaceRoomsBar's showSpaceSettings).
    const canSettings =
      memberCanManageSpace(sp, roles, me, uid) ||
      memberCanManageRoles(sp, roles, me, uid) ||
      memberCanManageNicknames(sp, roles, me, uid);
    const isOwner = !!sp && sp.owner_id === uid;
    const currentFolder = spaceFolders.folderForSpace(spaceId);

    // Invite/Settings modals live in that space's SpaceRoomsBar: flag the action and, if it's not
    // the space we're viewing, navigate there so its bar mounts and picks the request up.
    const openAction = (action: SpaceQuickAction) => {
      requestSpaceAction(spaceId, action);
      if (activeSpaceId() !== spaceId) navigate(`/spaces/${spaceId}`);
    };

    const createFolderForSpace = () => {
      const orderBefore = railItems().map(railId);
      const anchorIndex = orderBefore.indexOf(currentFolder?.id ?? spaceId);
      const folder = spaceFolders.create(t('space.folders.defaultName'), { spaceIds: [spaceId] });
      placeNewFolder(folder.id, anchorIndex >= 0 ? anchorIndex : 0);
      setEditingFolderId(folder.id);
      setShowFolderSettings(true);
    };

    showContextMenu(e, [
      ...(canInvite
        ? [{ label: t('space.inviteMembers'), icon: 'fa-user-plus', onClick: () => openAction('invite') }]
        : []),
      ...(canSettings
        ? [{ label: t('space.settings'), icon: 'fa-sliders', onClick: () => openAction('settings') }]
        : []),
      // User Settings is one app-wide modal, so unlike Invite/Settings this needs no
      // navigation to the space first.
      {
        label: t('spaceProfile.edit'),
        icon: 'fa-id-badge',
        onClick: () => openUserSettings('spaceProfiles', { spaceId }),
      },
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
      {
        label: t('space.folders.createForSpace'),
        icon: 'fa-folder-plus',
        onClick: createFolderForSpace,
      },
      ...(currentFolder
        ? [
            {
              label: t('space.folders.removeFromFolder'),
              icon: 'fa-folder-minus',
              onClick: () => spaceFolders.setSpaceFolder(spaceId, null),
            },
          ]
        : []),
      ...(folders().some((f) => f.id !== currentFolder?.id)
        ? [
            {
              label: t('space.folders.moveTo'),
              icon: 'fa-folder-open',
              onClick: () => {},
              submenu: folders()
                .filter((f) => f.id !== currentFolder?.id)
                .map((f) => ({
                  label: f.name,
                  icon: (f.icon || 'fa-folder').replace(/^fa-solid\s+/, ''),
                  color: f.color,
                  onClick: () => spaceFolders.setSpaceFolder(spaceId, f.id),
                })),
            },
          ]
        : []),
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

  function openFolderMenu(e: MouseEvent, folderId: string) {
    showContextMenu(e, [
      {
        label: t('space.folders.settings'),
        icon: 'fa-sliders',
        onClick: () => {
          setEditingFolderId(folderId);
          setShowFolderSettings(true);
        },
      },
      {
        label: t('space.folders.delete'),
        icon: 'fa-trash',
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog({
            title: t('space.folders.delete'),
            body: t('space.folders.deleteConfirm'),
            confirmLabel: t('space.folders.delete'),
            tone: 'danger',
            icon: 'fa-solid fa-trash',
          });
          if (!ok) return;
          spaceFolders.remove(folderId);
        },
      },
    ]);
  }

  function renderFolder(folder: SpaceFolder) {
    const collapsed = () => !!folder.collapsed;
    const [closing, setClosing] = createSignal(false);
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    onCleanup(() => clearTimeout(closeTimer));
    const membersVisible = () => !collapsed() || closing();
    function toggleCollapsed() {
      if (closing()) return;
      if (collapsed()) {
        spaceFolders.update(folder.id, { collapsed: false });
        return;
      }
      if (document.documentElement.classList.contains('reduce-motion')) {
        spaceFolders.update(folder.id, { collapsed: true });
        return;
      }
      setClosing(true);
      closeTimer = setTimeout(() => {
        setClosing(false);
        spaceFolders.update(folder.id, { collapsed: true });
      }, 120);
    }
    const folderSpaces = createMemo(() => {
      const byId = new Map(spaces.spaces.map((s) => [s.id, s]));
      return folder.spaceIds.map((id) => byId.get(id)).filter((s): s is Space => !!s);
    });
    const previewSpaces = createMemo(() => folderSpaces().slice(0, 4));
    const isFolderTarget = () => {
      const target = dropTarget();
      return target?.kind === 'folder' && target.id === folder.id;
    };
    const folderColor = () => folder.color || DEFAULT_FOLDER_COLOR;
    const folderUnread = createMemo(() => folderSpaces().reduce((n, s) => n + spaceUnreadCount(s.id), 0));
    const folderMentions = createMemo(() => folderSpaces().reduce((n, s) => n + spaceMentionCount(s.id), 0));
    return (
      <div
        data-folder-id={folder.id}
        data-rail-id={folder.id}
        class="flex w-fit flex-col items-center"
        style={reorder.styleFor(folder.id)}
      >
        <div
          data-folder-drop-id={folder.id}
          class="flex flex-col items-center gap-1 rounded-2xl transition-colors duration-150"
          classList={{
            'w-14 p-1': !collapsed(),
            'space-folder-panel-open': hasMountedRail && !collapsed() && !closing(),
            'space-folder-panel-close': closing(),
          }}
          style={!collapsed() ? { 'background-color': folderSurfaceColor(folderColor()) } : undefined}
        >
          <div class="relative w-12" onPointerDown={(e) => reorder.start(e, folder.id, e.currentTarget)}>
            <Show when={collapsed() && folderUnread() > 0}>
              <div class="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-foreground pointer-events-none" />
            </Show>
            <Tooltip label={folder.name}>
              <button
                type="button"
                data-folder-drop-id={folder.id}
                class="group relative flex size-12 cursor-pointer items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={folder.name}
                aria-expanded={!collapsed()}
                onClick={toggleCollapsed}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openFolderMenu(e, folder.id);
                }}
              >
                <span
                  class="relative flex size-12 items-center justify-center rounded-[16px] transition-all duration-200"
                  style={{
                    'background-color': `${folderColor()}33`,
                    color: folderColor(),
                    transform: isFolderTarget() ? 'scale(1.06) rotate(-3deg)' : undefined,
                    'box-shadow': isFolderTarget() ? `0 0 0 2px ${folderColor()}66` : undefined,
                  }}
                >
                  <Show
                    when={folder.useSpaceIcons && collapsed() && !closing() && previewSpaces().length > 0}
                    fallback={<i class={`${folder.icon || 'fa-solid fa-folder'} text-lg`} aria-hidden="true" />}
                  >
                    <span class="flex size-10 flex-wrap content-center items-center justify-center gap-0.5 overflow-hidden rounded-[10px]">
                      <For each={previewSpaces()}>
                        {(s) => (
                          <span class="flex size-[19px] items-center justify-center overflow-hidden rounded-[4px] bg-primary/30 text-[8px] font-semibold text-foreground">
                            <Show when={s.icon} fallback={<span>{spaceInitial(s)}</span>}>
                              <img src={s.icon!} alt="" class="size-full object-cover" draggable={false} />
                            </Show>
                          </span>
                        )}
                      </For>
                    </span>
                  </Show>
                  <Show when={isFolderTarget()}>
                    <span class="absolute inset-0 flex items-center justify-center rounded-[16px] bg-black/20">
                      <i class="fa-solid fa-arrow-down animate-bounce text-xs text-white" aria-hidden="true" />
                    </span>
                  </Show>
                  <Show when={collapsed() && folderMentions() > 0}>
                    <span class="absolute -top-1 -right-1 z-10 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1 ring-2 ring-background">
                      {folderMentions() > 99 ? '99+' : folderMentions()}
                    </span>
                  </Show>
                  <Show when={collapsed() && folderSpaces().length > 0}>
                    <span class="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[10px] font-semibold text-foreground ring-1 ring-border">
                      {folderSpaces().length}
                    </span>
                  </Show>
                </span>
              </button>
            </Tooltip>
          </div>
          <Show when={membersVisible()}>
            <div
              class="flex w-full flex-col items-center gap-1"
              classList={{
                'space-folder-members-open': hasMountedRail && !closing(),
                'space-folder-members-close': closing(),
                'pointer-events-none': closing(),
              }}
            >
              <For each={folderSpaces()}>
                {(s) => (
                  <div
                    data-space-id={s.id}
                    data-rail-id={s.id}
                    class="w-full"
                    style={reorder.styleFor(s.id)}
                    onPointerDown={(e) => reorder.start(e, s.id, e.currentTarget)}
                  >
                    <Tooltip label={s.name || t('space.unnamed')}>
                      <SpaceIcon
                        name={s.name || t('space.unnamed')}
                        initial={spaceInitial(s)}
                        icon={s.icon || undefined}
                        dropId={s.id}
                        railIndicator
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
                  </div>
                )}
              </For>
              <Show when={folderSpaces().length === 0}>
                <div class="flex h-10 w-10 items-center justify-center rounded-lg text-[10px] text-muted-foreground">
                  <i class="fa-solid fa-folder-open" aria-hidden="true" />
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    );
  }

  function renderSpace(space: Space) {
    const isSpaceTarget = () => {
      const target = dropTarget();
      return target?.kind === 'space' && target.id === space.id;
    };
    return (
      <div
        data-space-id={space.id}
        data-rail-id={space.id}
        class="relative w-full rounded-2xl"
        style={reorder.styleFor(space.id)}
        onPointerDown={(e) => reorder.start(e, space.id, e.currentTarget)}
      >
        <Tooltip label={space.name || t('space.unnamed')}>
          <SpaceIcon
            name={space.name || t('space.unnamed')}
            initial={spaceInitial(space)}
            icon={space.icon || undefined}
            dropId={space.id}
            dropActive={isSpaceTarget()}
            href={(() => {
              const lastRoom = lastSpaceRoom.get(space.id);
              return lastRoom ? `/spaces/${space.id}/rooms/${lastRoom}` : `/spaces/${space.id}`;
            })()}
            active={activeSpaceId() === space.id}
            unreadCount={spaceUnreadCount(space.id)}
            mentionCount={spaceMentionCount(space.id)}
            onContextMenu={(e) => openSpaceMenu(e, space.id)}
          />
        </Tooltip>
        <Show when={isSpaceTarget()}>
          <span class="pointer-events-none absolute end-3 top-0 z-20 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
            <i class="fa-solid fa-folder-plus text-[8px]" aria-hidden="true" />
          </span>
        </Show>
      </div>
    );
  }

  const isHomeAppActive = () => {
    const p = pathname();
    return p === '/' || p === '/friends' || p === '/notes' || p.startsWith('/rooms/');
  };

  // Always rendered: below md this is the left half of the swipe pager's nav panel, so it
  // has to stay mounted even while the conversation is on screen.
  return (
    <aside
      ref={setRailEl}
      class={`flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-3 ${appSpaceRail}`}
    >
      <CreateSpaceModal open={showCreateSpace()} onClose={() => setShowCreateSpace(false)} />
      <SpaceFolderSettingsModal
        open={showFolderSettings()}
        folderId={editingFolderId()}
        onCreated={focusNewFolder}
        onClose={() => {
          setShowFolderSettings(false);
          setEditingFolderId(null);
        }}
      />
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
            aria-label={t('nav.privateMessages')}
            class={`relative flex items-center justify-center size-12 transition-all duration-200 ${
              isHomeAppActive()
                ? 'text-foreground bg-primary/30 rounded-[16px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/20 rounded-[24px] hover:rounded-[16px]'
            }`}
          >
            <span class="relative inline-flex items-center justify-center">
              <HomeIcon />
              <Show when={friendRequestCount() > 0}>
                <span class="absolute -top-1 -right-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1" title={t('friends.pendingRequests', { count: friendRequestCount() })}>
                  {friendRequestCount() > 99 ? '99+' : friendRequestCount()}
                </span>
              </Show>
            </span>
          </A>
        </div>
      </Tooltip>
      <Show when={railDms().length > 0}>
        <For each={railDms()}>
          {(room) => (
            <Tooltip label={roomDisplayName(room, currentUserId())}>
              <DmRailIcon room={room} active={activePmRoomId() === room.id} unread={dmUnread(room)} />
            </Tooltip>
          )}
        </For>
      </Show>
      <Divider />

      <For each={railItems()}>
        {(item, index) => (
          <div class="relative flex w-full justify-center">
            <Show when={ungroupIndex() === index()}>
              <span data-ungroup-marker class="pointer-events-none absolute -top-1.5 z-30 h-0.5 w-10 rounded-full bg-primary" />
            </Show>
            {isFolderItem(item) ? renderFolder(item) : renderSpace(item)}
          </div>
        )}
      </For>
      <Show when={ungroupIndex() !== null && ungroupIndex() === railItems().length}>
        <div class="pointer-events-none relative h-0 w-10">
          <span data-ungroup-marker class="absolute -top-0.5 h-0.5 w-10 rounded-full bg-primary" />
        </div>
      </Show>

      <Divider />
      <Tooltip label={t('space.addSpace')}>
        <div class="group relative w-full flex items-center justify-center min-h-12">
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
          <button
            type="button"
            aria-label={t('space.addSpace')}
            class="relative flex items-center justify-center size-12 rounded-[24px] text-muted-foreground hover:text-foreground hover:bg-primary/20 hover:rounded-[16px] transition-all duration-200"
            onClick={() => setShowCreateSpace(true)}
          >
            <PlusIcon />
          </button>
        </div>
      </Tooltip>
      <Tooltip label={t('discover.title')}>
        <div class="group relative w-full flex items-center justify-center min-h-12">
          <Show
            when={location.pathname === '/discover'}
            fallback={
              <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" />
            }
          >
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-foreground pointer-events-none" />
          </Show>
          <A
            href="/discover"
            aria-label={t('discover.title')}
            data-space-bar-discover
            class={`relative flex items-center justify-center size-12 transition-all duration-200 ${
              location.pathname === '/discover'
                ? 'text-foreground bg-primary/30 rounded-[16px]'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/20 rounded-[24px] hover:rounded-[16px]'
            }`}
          >
            <i class="fa-solid fa-compass text-xl" aria-hidden="true" />
          </A>
        </div>
      </Tooltip>
    </aside>
  );
};
