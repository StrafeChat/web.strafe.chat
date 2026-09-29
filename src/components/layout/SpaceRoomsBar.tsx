import type { Component } from 'solid-js';
import { createSignal, createResource, createMemo, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useParams, useMatch, useNavigate } from '@solidjs/router';
import { deleteSpaceRoom, getSpaceRooms, leaveSpace, type SpaceRoom } from '../../api/spaces';
import { openReportDialog } from '../ReportDialog';
import { spaces, setSpaceRooms, removeSpace, spaceRoles, ensureSpaceRoles, refreshSpaceRooms } from '../../stores/spaces';
import { messages } from '../../stores/messages';
import { auth } from '../../stores/auth';
import { readState, getUnreadCountForDisplay, ackRoomOptimistic } from '../../stores/readState';
import { UserArea } from './UserArea';
import { VoiceDock } from '../voice/VoiceDock';
import {
  appChannelRail,
  appHeaderBar,
  appMenuItemDanger,
  appMenuItemDefault,
  appMenuPanel,
  appMenuSeparator,
  appSectionLabel,
  zLayer,
} from '../../theme/appChrome';
import { confirmDialog } from '../../stores/confirmDialog';
import { isMdViewport } from '../../stores/mobileShellLayout';
import { IconButton } from '../ui/IconButton';
import { showContextMenu } from '../../stores/contextMenu';
import { isRoomMuted, muteRoom, unmuteRoom } from '../../lib/roomNotify';
import { spaceMembers, loadSpaceMembers } from '../../stores/spaceMembers';
import {
  memberCanCreateInvite,
  memberCanManageRooms,
  memberCanManageRoles,
  memberCanManageSpace,
} from '../../lib/spacePermissions';
import { SpaceRoomSettingsModal } from '../SpaceRoomSettingsModal';
import { InviteSpaceModal } from '../InviteSpaceModal';
import { SpaceSettingsModal } from '../SpaceSettingsModal';
import { CreateSpaceRoomModal, CreateSpaceSectionModal } from '../CreateSpaceChannelModal';
import { MIME_STRAFE_ROOM_REORDER } from '../../lib/roomReorder';
import { createRoomReorder } from './spaceRooms/createRoomReorder';
import { ChevronDownIcon } from './spaceRooms/RoomTypeIcon';
import { SpaceChannelRow } from './spaceRooms/SpaceChannelRow';
import { t } from '../../i18n';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;



export const SpaceRoomsBar: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const spaceId = () => params.spaceId;
  const roomMatch = useMatch(() => '/spaces/:spaceId/rooms/:roomId');
  const activeRoomId = () => roomMatch()?.params?.roomId;

  // Sections are open by default; we only remember the ones the user explicitly collapsed,
  // persisted per device so the state survives navigating between spaces, remounts and
  // reloads. (The previous approach tracked "open" ids in a fresh-every-mount signal seeded
  // once, so switching spaces left the new space's sections out of the set - all collapsed.)
  const COLLAPSED_SECTIONS_KEY = 'strafe:collapsedSectionIds';
  const loadCollapsedSections = (): Set<string> => {
    try {
      const raw = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {
      /* private mode / bad json */
    }
    return new Set();
  };
  const [collapsedSectionIds, setCollapsedSectionIds] = createSignal<Set<string>>(loadCollapsedSections());

  const space = () => spaces.spaces.find((s) => s.id === spaceId());
  const [editingRoom, setEditingRoom] = createSignal<SpaceRoom | null>(null);
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [spaceSettingsOpen, setSpaceSettingsOpen] = createSignal(false);
  const [leaveBusy, setLeaveBusy] = createSignal(false);
  const isSpaceOwner = createMemo(() => {
    const me = auth.user?.id;
    return me != null && space()?.owner_id === me;
  });

  async function handleLeaveSpace() {
    const sid = spaceId();
    if (!sid || leaveBusy()) return;
    const ok = await confirmDialog({
      title: t('space.leave'),
      body: t('space.leaveConfirm', { name: space()?.name ?? t('space.thisSpace') }),
      confirmLabel: t('space.leave'),
      tone: 'danger',
      icon: 'fa-solid fa-right-from-bracket',
    });
    if (!ok) return;
    setLeaveBusy(true);
    try {
      await leaveSpace(sid);
      removeSpace(sid);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Failed to leave space:', err);
    } finally {
      setLeaveBusy(false);
    }
  }
  const [createRoomOpen, setCreateRoomOpen] = createSignal(false);
  /** Section id to parent new text room under, or null for default / menu create */
  const [createRoomParentSectionId, setCreateRoomParentSectionId] = createSignal<string | null>(null);
  const [createSectionOpen, setCreateSectionOpen] = createSignal(false);
  const [spaceMenuOpen, setSpaceMenuOpen] = createSignal(false);
  const [spaceMenuPos, setSpaceMenuPos] = createSignal<{ top: number; left: number; width: number } | null>(null);

  let spaceMenuTriggerEl: HTMLButtonElement | undefined;
  let spaceMenuPanelEl: HTMLDivElement | undefined;
  let roomsScrollEl: HTMLDivElement | undefined;
  const [roomsRes] = createResource(spaceId, async (id) => {
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    const list = await getSpaceRooms(id);
    setSpaceRooms(id, list);
    return list;
  });
  const spaceRooms = createMemo(() => {
    const id = spaceId();
    if (!id) return [];
    const fromStore = spaces.spaceRoomsBySpaceId[id];
    if (fromStore?.length) return fromStore;
    return roomsRes() ?? [];
  });
  // Roles come with the space (READY / GET /spaces) and are kept current by
  // SPACE_ROLE_* events; ensureSpaceRoles only fetches for a space that lacks them.
  createEffect(() => {
    const sid = spaceId();
    if (sid) void ensureSpaceRoles(sid);
  });
  const rolesRes = createMemo(() => {
    const sid = spaceId();
    return sid ? spaceRoles(sid) : undefined;
  });
  const currentMember = createMemo(() => {
    const sid = spaceId();
    const me = auth.user?.id;
    if (!sid || !me) return undefined;
    return spaceMembers.bySpaceId[sid]?.find((m) => m.id === me) as
      | ({ roles?: string[] } & { id: string })
      | undefined;
  });
  // Was hand-rolled here and missed the Administrator bypass the server grants, so an
  // admin role without an explicit Manage rooms bit couldn't create or edit rooms.
  const canManageRooms = createMemo(() =>
    memberCanManageRooms(space(), rolesRes(), currentMember(), auth.user?.id)
  );
  const canCreateInvite = createMemo(() =>
    memberCanCreateInvite(space(), rolesRes(), currentMember(), auth.user?.id)
  );
  const canManageSpace = createMemo(() =>
    memberCanManageSpace(space(), rolesRes(), currentMember(), auth.user?.id)
  );
  const canManageRoles = createMemo(() =>
    memberCanManageRoles(space(), rolesRes(), currentMember(), auth.user?.id)
  );
  const showSpaceSettings = createMemo(() => canManageSpace() || canManageRoles());
  const sections = () =>
    spaceRooms()
      .filter((r) => r.type === ROOM_TYPE_SECTION)
      .sort((a, b) => a.position - b.position);

  const sectionIds = createMemo(() => new Set(sections().map((s) => s.id)));

  const topLevelRooms = createMemo(() =>
    spaceRooms()
      .filter(
        (r) =>
          (r.type === ROOM_TYPE_TEXT || r.type === ROOM_TYPE_VOICE) &&
          (!r.parent_id || !sectionIds().has(r.parent_id))
      )
      .sort((a, b) => a.position - b.position)
  );

  function toggleSection(sectionId: string) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      try {
        localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...next]));
      } catch {
        /* private mode */
      }
      return next;
    });
  }

  function childrenOf(section: SpaceRoom) {
    return spaceRooms()
      .filter((r) => r.parent_id === section.id)
      .sort((a, b) => a.position - b.position);
  }

  /** Ids in display order for a reorder scope — the one thing the drag layer needs to
   * know about how this list is built. */
  function orderedIdsForScope(scopeKey: string): string[] {
    if (scopeKey === 'sections') return sections().map((s) => s.id);
    if (scopeKey === 'top') return topLevelRooms().map((r) => r.id);
    if (scopeKey.startsWith('sec:')) {
      const secId = scopeKey.slice(4);
      const sec = spaceRooms().find((r) => r.id === secId && r.type === ROOM_TYPE_SECTION);
      return sec ? childrenOf(sec).map((r) => r.id) : [];
    }
    return [];
  }

  const reorder = createRoomReorder({
    spaceId,
    canManageRooms,
    orderedIdsForScope,
    scrollEl: () => roomsScrollEl,
  });
  const activeReorderDrag = reorder.activeReorderDrag;
  const reorderLineRect = reorder.reorderLineRect;

  function latestMessageID(room: SpaceRoom): string | null {
    const list = messages.byRoom[room.id] ?? [];
    const snowflakes = list.filter((m) => /^\d+$/.test(m.id));
    if (snowflakes.length === 0) {
      return room.last_message_id ?? null;
    }
    const latest = snowflakes.reduce((a, b) => (BigInt(b.id) > BigInt(a.id) ? b : a));
    return latest.id;
  }

  function openRoomMenu(e: MouseEvent, room: SpaceRoom) {
    const sid = spaceId();
    if (!sid) return;
    const msgId = latestMessageID(room);
    const uid = auth.user?.id ?? '';
    // Same rule SpaceChannelRow's badge uses (getUnreadCountForDisplay + the real mention
    // counter) - this used to be a separate, looser check that could disagree with the badge.
    const mentionCount = readState.byRoom[room.id]?.mentionCount ?? 0;
    const unread =
      mentionCount > 0 ||
      (!!uid &&
        getUnreadCountForDisplay(
          room.id,
          { ...room, space_id: room.space_id ?? sid },
          messages.byRoom[room.id] ?? [],
          uid
        ) > 0);
    showContextMenu(e, [
      {
        label: t('space.roomSettings'),
        icon: 'fa-gear',
        disabled: !canManageRooms(),
        onClick: () => setEditingRoom(room),
      },
      ...(msgId && unread
        ? [{
            label: t('contextMenu.markAsRead'),
            icon: 'fa-check-double',
            onClick: () => ackRoomOptimistic(room.id, msgId),
          }]
        : []),
      {
        label: isRoomMuted(room) ? t('contextMenu.unmute') : t('contextMenu.mute'),
        icon: isRoomMuted(room) ? 'fa-bell' : 'fa-bell-slash',
        onClick: () =>
          void (isRoomMuted(room) ? unmuteRoom(room.id) : muteRoom(room.id, null)).catch((err) =>
            console.error('Toggle mute failed:', err)
          ),
      },
      {
        label: t('contextMenu.copyRoomLink'),
        icon: 'fa-link',
        onClick: () => navigator.clipboard.writeText(`${window.location.origin}/spaces/${sid}/rooms/${room.id}`),
      },
      {
        label: t('contextMenu.copyRoomId'),
        icon: 'fa-copy',
        onClick: () => navigator.clipboard.writeText(room.id),
      },
      {
        label: t('space.deleteRoom'),
        icon: 'fa-trash',
        danger: true,
        disabled: !canManageRooms(),
        onClick: async () => {
          if (!canManageRooms()) return;
          await deleteSpaceRoom(sid, room.id);
          setSpaceRooms(sid, (spaceRooms().filter((r) => r.id !== room.id)));
          if (activeRoomId() === room.id) {
            const fallback = spaceRooms().find((r) => r.type === ROOM_TYPE_TEXT || r.type === ROOM_TYPE_VOICE);
            // Client-side: a full reload here threw away every store and re-ran the
            // whole READY hydration just to move one room over.
            navigate(fallback ? `/spaces/${sid}/rooms/${fallback.id}` : `/spaces/${sid}`, { replace: true });
          }
        },
      },
    ]);
  }

  function updateSpaceMenuPosition() {
    if (!spaceMenuOpen() || !spaceMenuTriggerEl) return;
    const rect = spaceMenuTriggerEl.getBoundingClientRect();
    const minW = 220;
    const maxW = 300;
    const width = Math.min(Math.max(rect.width, minW), maxW);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setSpaceMenuPos({ top: rect.bottom + 6, left, width });
  }

  createEffect(() => {
    if (!spaceMenuOpen()) {
      setSpaceMenuPos(null);
      return;
    }
    updateSpaceMenuPosition();
    const onScrollOrResize = () => updateSpaceMenuPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    onCleanup(() => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    });
  });

  createEffect(() => {
    if (!spaceMenuOpen()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpaceMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  onMount(() => {
    function onDocClick(e: MouseEvent) {
      if (!spaceMenuOpen()) return;
      const t = e.target as Node;
      if (spaceMenuTriggerEl?.contains(t) || spaceMenuPanelEl?.contains(t)) return;
      setSpaceMenuOpen(false);
    }
    document.addEventListener('click', onDocClick);
    onCleanup(() => document.removeEventListener('click', onDocClick));
  });

  onMount(() => {
    const clearReorderUi = () => reorder.setReorderDragActive(null);
    document.addEventListener('dragend', clearReorderUi);
    onCleanup(() => document.removeEventListener('dragend', clearReorderUi));
  });

  function afterChannelCreated() {
    const sid = spaceId();
    if (!sid) return;
    void refreshSpaceRooms(sid).catch(() => {});
  }


  createEffect(() => {
    const sid = spaceId();
    if (sid && !spaceMembers.bySpaceId[sid]) {
      loadSpaceMembers(sid).catch(() => {});
    }
  });


  return (
    <aside
      class={`flex w-[calc(100vw-72px)] shrink-0 flex-col overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:w-[240px] md:pb-0 ${appChannelRail}`}
    >
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        <div class={`flex h-12 shrink-0 items-center gap-2 px-3 ${appHeaderBar}`}>
          <button
            type="button"
            ref={(el) => {
              spaceMenuTriggerEl = el;
            }}
            id="space-header-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={spaceMenuOpen()}
            class="flex items-center gap-2 min-w-0 flex-1 rounded-lg hover:bg-accent/50 px-2 py-1.5 text-left transition-colors active:scale-[0.99]"
            onClick={(e) => {
              e.stopPropagation();
              setSpaceMenuOpen((o) => {
                const next = !o;
                if (next) queueMicrotask(() => updateSpaceMenuPosition());
                return next;
              });
            }}
          >
            <span class="size-8 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/40 flex items-center justify-center">
              <Show
                when={space()?.icon}
                fallback={
                  <span class="text-[11px] font-semibold text-foreground">
                    {(space()?.name_acronym || space()?.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                }
              >
                <img src={space()!.icon} alt="" class="size-full object-cover" />
              </Show>
            </span>
            <span class="text-base font-semibold text-foreground truncate">
              {space()?.name || t('emoji.picker.space')}
            </span>
            <ChevronDownIcon
              class={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                spaceMenuOpen() ? 'rotate-180' : ''
              }`}
            />
          </button>
          <Show when={spaceMenuOpen() && spaceMenuPos()}>
            <Portal mount={document.body}>
              <div
                ref={(el) => {
                  spaceMenuPanelEl = el;
                }}
                id="space-header-dropdown"
                role="menu"
                aria-labelledby="space-header-menu-trigger"
                class={`fixed ${zLayer.popover} ${appMenuPanel}`}
                style={{
                  top: `${spaceMenuPos()!.top}px`,
                  left: `${spaceMenuPos()!.left}px`,
                  width: `${spaceMenuPos()!.width}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div class="flex flex-col gap-0.5">
                  {/* Gated like every other entry: the server requires Create invite /
                      Administrator / owner, so offering it to everyone just produced a 403. */}
                  <Show when={canCreateInvite()}>
                    <button
                      type="button"
                      role="menuitem"
                      class={`${appMenuItemDefault} justify-between`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        setInviteOpen(true);
                      }}
                    >
                      <span>{t('space.inviteMembers')}</span>
                      <i class="fa-solid fa-user-plus text-[13px] text-muted-foreground" aria-hidden />
                    </button>
                  </Show>
                  <Show when={showSpaceSettings()}>
                    <button
                      type="button"
                      role="menuitem"
                      class={`${appMenuItemDefault} justify-between`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        setSpaceSettingsOpen(true);
                      }}
                    >
                      <span>{t('space.settings')}</span>
                      <i class="fa-solid fa-sliders text-[13px] text-muted-foreground" aria-hidden />
                    </button>
                  </Show>
                  <Show when={canManageRooms()}>
                    <button
                      type="button"
                      role="menuitem"
                      class={`${appMenuItemDefault} justify-between`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        setCreateRoomParentSectionId(null);
                        setCreateRoomOpen(true);
                      }}
                    >
                      <span>{t('createRoom.submit')}</span>
                      <i class="fa-solid fa-hashtag text-[13px] text-muted-foreground" aria-hidden />
                    </button>
                  </Show>
                  <Show when={canManageRooms()}>
                    <button
                      type="button"
                      role="menuitem"
                      class={`${appMenuItemDefault} justify-between`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        setCreateSectionOpen(true);
                      }}
                    >
                      <span>{t('createSection.submit')}</span>
                      <i class="fa-solid fa-folder text-[13px] text-muted-foreground" aria-hidden />
                    </button>
                  </Show>
                  <Show when={!isSpaceOwner()}>
                    <div class={appMenuSeparator} role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      class={`${appMenuItemDanger} justify-between`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        const sp = space();
                        if (sp) openReportDialog({ targetType: 'space', targetId: sp.id, targetName: sp.name, spaceId: sp.id });
                      }}
                    >
                      <span>{t('space.report')}</span>
                      <i class="fa-solid fa-flag text-[13px]" aria-hidden />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={leaveBusy()}
                      class={`${appMenuItemDanger} justify-between disabled:opacity-50`}
                      onClick={() => {
                        setSpaceMenuOpen(false);
                        void handleLeaveSpace();
                      }}
                    >
                      <span>{t('space.leave')}</span>
                      <i class="fa-solid fa-right-from-bracket text-[13px]" aria-hidden />
                    </button>
                  </Show>
                </div>
              </div>
            </Portal>
          </Show>
        </div>

        {/* No Members row here: the member list is toggled from the channel header, the
            same single entry point Discord uses. */}

        <div
          ref={(el) => {
            roomsScrollEl = el;
          }}
          class="flex-1 flex flex-col min-h-0 overflow-y-auto py-2 px-3"
        >
          <Show when={roomsRes.loading}>
            <div class="px-2 py-1.5 text-xs text-muted-foreground">{t('common.loading')}</div>
          </Show>
          <Show
            when={() =>
              !roomsRes.loading &&
              (topLevelRooms().length > 0 || (canManageRooms() && activeReorderDrag()?.kind === 'channel'))
            }
          >
            <div class="mb-2 space-y-0.5">
              <For each={topLevelRooms()}>
                {(room) => (
                  <div data-reorder-anchor="top" data-reorder-id={room.id}>
                    <SpaceChannelRow
                      room={room}
                      spaceId={spaceId()!}
                      activeRoomId={activeRoomId()}
                      onContextMenu={openRoomMenu}
                      onEditRoom={canManageRooms() ? setEditingRoom : undefined}
                      onInvite={canCreateInvite() ? () => setInviteOpen(true) : undefined}
                      reorderScopeKey="top"
                      reorderEnabled={canManageRooms()}
                      reorderDragSource={() =>
                        activeReorderDrag()?.kind === 'channel' &&
                        activeReorderDrag()?.scopeKey === 'top' &&
                        activeReorderDrag()?.id === room.id
                      }
                      onReorderDragActive={reorder.setReorderDragActive}
                      onReorderDragOverTarget={(e, id) => reorder.updateDropIndicatorForRow('top', id, e)}
                      onReorderDrop={(e, id) => reorder.commitReorderFromDropEvent(e, 'top', id)}
                    />
                  </div>
                )}
              </For>
              <Show when={() => canManageRooms() && activeReorderDrag()?.kind === 'channel'}>
                <div
                  data-reorder-end="top"
                  class="relative h-2 shrink-0 -mt-0.5 rounded-sm"
                  onDragOver={(e) => reorder.handleEndStripDragOver(e, 'top')}
                  onDrop={(e) => reorder.handleReorderStripDrop(e, 'top')}
                />
              </Show>
            </div>
          </Show>
          <For each={sections()}>
            {(section) => {
              const isOpen = () => !collapsedSectionIds().has(section.id);
              const children = () => childrenOf(section);
              const secScope = `sec:${section.id}`;
              // Collapsing a section otherwise hides its children's unread/mention state
              // entirely - roll it up onto the header itself while collapsed.
              const collapsedHasUnread = () => {
                if (isOpen()) return false;
                const uid = auth.user?.id ?? '';
                if (!uid) return false;
                return children().some((c) => {
                  if (c.type !== ROOM_TYPE_TEXT || c.id === activeRoomId()) return false;
                  if ((readState.byRoom[c.id]?.mentionCount ?? 0) > 0) return true;
                  return (
                    getUnreadCountForDisplay(
                      c.id,
                      { ...c, space_id: c.space_id ?? spaceId() },
                      messages.byRoom[c.id] ?? [],
                      uid
                    ) > 0
                  );
                });
              };
              return (
                <div class="mb-2">
                  <div
                    data-section-header={section.id}
                    data-reorder-anchor="sections"
                    data-reorder-id={section.id}
                    class={`relative flex w-full items-center gap-0.5 rounded-md px-1 ${
                      activeReorderDrag()?.kind === 'section' &&
                      activeReorderDrag()?.scopeKey === 'sections' &&
                      activeReorderDrag()?.id === section.id
                        ? 'bg-muted/60 ring-1 ring-inset ring-dashed ring-primary/35'
                        : ''
                    }`}
                    draggable={canManageRooms()}
                    onDragStart={(e) => {
                      if (!canManageRooms()) return;
                      e.dataTransfer?.setData(
                        MIME_STRAFE_ROOM_REORDER,
                        JSON.stringify({ kind: 'section', scopeKey: 'sections', id: section.id })
                      );
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                      reorder.setReorderDragActive({ kind: 'section', scopeKey: 'sections', id: section.id });
                    }}
                    onDragOver={(e) => {
                      reorder.handleSectionHeaderDragOver(e, section.id, isOpen());
                    }}
                    onDrop={(e) => reorder.handleSectionHeaderDrop(e, section.id, isOpen())}
                  >
                    <button
                      type="button"
                      class={`flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left transition-colors hover:text-foreground ${appSectionLabel}`}
                      aria-expanded={isOpen()}
                      onClick={() => toggleSection(section.id)}
                    >
                      <ChevronDownIcon
                        class={`size-3.5 shrink-0 transition-transform ${isOpen() ? '' : '-rotate-90'}`}
                      />
                      <span class="truncate">{section.name || t('space.unnamed')}</span>
                      <Show when={collapsedHasUnread()}>
                        <span class="size-1.5 shrink-0 rounded-full bg-primary" />
                      </Show>
                    </button>
                    <Show when={canManageRooms()}>
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-plus"
                        label={t('space.createRoomIn', { name: section.name || t('space.section') })}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCreateRoomParentSectionId(section.id);
                          setCreateRoomOpen(true);
                        }}
                      />
                    </Show>
                  </div>
                  <Show when={isOpen()}>
                    <div class="mt-0.5 space-y-0.5">
                      <For each={children()}>
                        {(room) => (
                          <div data-reorder-anchor={secScope} data-reorder-id={room.id}>
                            <SpaceChannelRow
                              room={room}
                              spaceId={spaceId()!}
                              activeRoomId={activeRoomId()}
                              onContextMenu={openRoomMenu}
                              onEditRoom={canManageRooms() ? setEditingRoom : undefined}
                              onInvite={canCreateInvite() ? () => setInviteOpen(true) : undefined}
                              reorderScopeKey={secScope}
                              reorderEnabled={canManageRooms()}
                              reorderDragSource={() =>
                                activeReorderDrag()?.kind === 'channel' &&
                                activeReorderDrag()?.scopeKey === secScope &&
                                activeReorderDrag()?.id === room.id
                              }
                              onReorderDragActive={reorder.setReorderDragActive}
                              onReorderDragOverTarget={(e, id) => reorder.updateDropIndicatorForRow(secScope, id, e)}
                              onReorderDrop={(e, id) => reorder.commitReorderFromDropEvent(e, secScope, id)}
                            />
                          </div>
                        )}
                      </For>
                      <Show when={() => canManageRooms() && activeReorderDrag()?.kind === 'channel'}>
                        <div
                          data-reorder-end={secScope}
                          class="relative h-2 shrink-0 -mt-0.5 rounded-sm"
                          onDragOver={(e) => reorder.handleEndStripDragOver(e, secScope)}
                          onDrop={(e) => reorder.handleReorderStripDrop(e, secScope)}
                        />
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
          <Show
            when={() =>
              canManageRooms() && sections().length > 0 && activeReorderDrag()?.kind === 'section'
            }
          >
            <div
              data-reorder-end="sections"
              class="relative h-2 shrink-0 rounded-sm"
              onDragOver={(e) => reorder.handleEndStripDragOver(e, 'sections', 'section')}
              onDrop={(e) => reorder.handleReorderStripDrop(e, 'sections')}
            />
          </Show>
        </div>
      </div>
      <Show when={reorderLineRect()}>
        {(rect) => (
          <Portal mount={document.body}>
            <div
              class={`pointer-events-none fixed ${zLayer.popover} h-0.5 rounded-sm bg-primary shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-background)_65%,transparent)]`}
              style={{
                top: `${rect().top}px`,
                left: `${rect().left}px`,
                width: `${rect().width}px`,
              }}
              aria-hidden
            />
          </Portal>
        )}
      </Show>
      {/* The mobile You tab replaces this dock, so it is desktop-only below md. */}
      <Show when={isMdViewport()}>
        <VoiceDock variant="rail" />
        <UserArea />
      </Show>
      <SpaceRoomSettingsModal
        open={!!editingRoom()}
        room={editingRoom()}
        spaceId={spaceId()!}
        members={spaceMembers.bySpaceId[spaceId()!] ?? []}
        canManageRooms={canManageRooms()}
        onClose={() => setEditingRoom(null)}
        onSaved={() => {
          const sid = spaceId();
          if (!sid) return;
          void refreshSpaceRooms(sid).catch(() => {});
        }}
      />
      <InviteSpaceModal
        open={inviteOpen()}
        spaceId={spaceId()!}
        onClose={() => setInviteOpen(false)}
      />
      <SpaceSettingsModal
        open={spaceSettingsOpen()}
        onClose={() => setSpaceSettingsOpen(false)}
        space={space()}
        spaceId={spaceId()!}
        roomId={activeRoomId() ?? null}
        members={spaceMembers.bySpaceId[spaceId()!] ?? []}
        canManageRoles={canManageRoles()}
        canManageSpace={canManageSpace()}
        ownerId={space()?.owner_id ?? ''}
        onMembersUpdated={() => {
          const sid = spaceId();
          if (sid) loadSpaceMembers(sid).catch(() => {});
        }}
      />
      <CreateSpaceRoomModal
        open={createRoomOpen()}
        onClose={() => {
          setCreateRoomOpen(false);
          setCreateRoomParentSectionId(null);
        }}
        spaceId={spaceId()!}
        spaceRooms={spaceRooms()}
        parentSectionId={createRoomParentSectionId()}
        onCreated={afterChannelCreated}
      />
      <CreateSpaceSectionModal
        open={createSectionOpen()}
        onClose={() => setCreateSectionOpen(false)}
        spaceId={spaceId()!}
        onCreated={afterChannelCreated}
      />
    </aside>
  );
};
