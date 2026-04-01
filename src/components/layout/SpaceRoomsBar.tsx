import type { Component } from 'solid-js';
import { createSignal, createResource, createMemo, createEffect, For, Show } from 'solid-js';
import { A, useParams, useMatch } from '@solidjs/router';
import { getSpaceRooms, type SpaceRoom } from '../../api/spaces';
import { spaces, setSpaceRooms } from '../../stores/spaces';
import { messages } from '../../stores/messages';
import { auth } from '../../stores/auth';
import { readState, getUnreadCountForDisplay } from '../../stores/readState';
import { UserArea } from './UserArea';
import { appChannelRail, appHeaderBar } from '../../theme/appChrome';
import { isMdViewport, mobileNavFocus } from '../../stores/mobileShellLayout';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;
const ROOM_TYPE_SECTION = 5;

const ChevronDownIcon = (props: { class?: string }) => (
  <svg class={props.class ?? 'size-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const MembersIcon = () => (
  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HashIcon = () => (
  <svg class="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

const SpeakerIcon = () => (
  <svg class="size-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

export const SpaceRoomsBar: Component = () => {
  const params = useParams();
  const spaceId = () => params.spaceId;
  const roomMatch = useMatch(() => '/spaces/:spaceId/rooms/:roomId');
  const activeRoomId = () => roomMatch()?.params?.roomId;

  /** Section ids that are expanded (collapsed when not in set) */
  const [openSectionIds, setOpenSectionIds] = createSignal<Set<string>>(new Set());
  const [sectionsInitialized, setSectionsInitialized] = createSignal(false);

  const space = () => spaces.spaces.find((s) => s.id === spaceId());
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
  const sections = () =>
    spaceRooms()
      .filter((r) => r.type === ROOM_TYPE_SECTION)
      .sort((a, b) => a.position - b.position);

  createEffect(() => {
    const secs = sections();
    if (secs.length > 0 && !sectionsInitialized()) {
      setOpenSectionIds(new Set(secs.map((s) => s.id)));
      setSectionsInitialized(true);
    }
  });

  function toggleSection(sectionId: string) {
    setOpenSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function childrenOf(section: SpaceRoom) {
    return spaceRooms()
      .filter((r) => r.parent_id === section.id)
      .sort((a, b) => a.position - b.position);
  }

  function roomIcon(room: SpaceRoom) {
    return room.type === ROOM_TYPE_VOICE ? <SpeakerIcon /> : <HashIcon />;
  }

  return (
    <aside
      class={`w-[240px] shrink-0 flex-col overflow-hidden ${appChannelRail} ${
        isMdViewport() || mobileNavFocus() === 'rails' ? 'flex' : 'hidden'
      }`}
    >
      <div class="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
        <div class={`flex h-12 shrink-0 items-center gap-2 px-3 ${appHeaderBar}`}>
          <button
            type="button"
            class="flex items-center gap-2 min-w-0 flex-1 rounded hover:bg-accent/50 px-2 py-1.5 text-left transition-colors"
          >
            <span class="text-base font-semibold text-foreground truncate">
              {space()?.name || 'Space'}
            </span>
            <ChevronDownIcon class="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <div class="px-3 py-2">
          <button
            type="button"
            class="flex items-center gap-2 w-full px-2 py-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm font-medium"
          >
            <MembersIcon />
            <span>Members</span>
          </button>
        </div>

        <div class="flex-1 flex flex-col min-h-0 overflow-y-auto py-2 px-3">
          <Show when={roomsRes.loading}>
            <div class="px-2 py-1.5 text-xs text-muted-foreground">Loading...</div>
          </Show>
          <Show when={!roomsRes.loading && sections().length === 0}>
            <div class="px-2 py-1.5 text-xs text-muted-foreground">No rooms</div>
          </Show>
          <For each={sections()}>
            {(section) => {
              const isOpen = () => openSectionIds().has(section.id);
              const children = () => childrenOf(section);
              return (
                <div class="mb-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 w-full px-2 py-1 text-muted-foreground hover:text-foreground transition-colors text-xs font-semibold uppercase tracking-wider"
                    onClick={() => toggleSection(section.id)}
                  >
                    <span>{section.name || 'Unnamed'}</span>
                    <ChevronDownIcon
                      class={`size-4 shrink-0 transition-transform ${isOpen() ? '' : '-rotate-90'}`}
                    />
                  </button>
                  <Show when={isOpen()}>
                    <div class="mt-0.5 space-y-0.5">
                      <For each={children()}>
                        {(room) => {
                          const list = () => messages.byRoom[room.id] ?? [];
                          const uid = auth.user?.id ?? '';
                          const mentions = () => readState.byRoom[room.id]?.mentionCount ?? 0;
                          const baseUnread = () => {
                            if (!uid) return 0;
                            if (activeRoomId() === room.id) return 0;
                            return getUnreadCountForDisplay(room.id, room, list(), uid);
                          };
                          return (
                            <A
                              href={`/spaces/${spaceId()!}/rooms/${room.id}`}
                              class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                                activeRoomId() === room.id
                                  ? 'bg-primary/15 text-foreground ring-1 ring-inset ring-primary/20'
                                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                              }`}
                            >
                              {roomIcon(room)}
                              <Show when={baseUnread() > 0 && mentions() === 0}>
                                <span class="w-1.5 h-1.5 rounded-full bg-primary" />
                              </Show>
                              <span
                                class={`truncate min-w-0 flex-1 ${
                                  baseUnread() > 0 || mentions() > 0
                                    ? 'font-semibold text-foreground'
                                    : ''
                                }`}
                              >
                                {room.name || 'unnamed'}
                              </span>
                              <Show when={mentions() > 0}>
                                <span class="shrink-0 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5">
                                  {mentions() > 99 ? '99+' : mentions()}
                                </span>
                              </Show>
                            </A>
                          );
                        }}
                      </For>
                      <Show when={children().length === 0}>
                        <div class="px-2 py-1.5 text-xs text-muted-foreground">No rooms</div>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
      <UserArea />
    </aside>
  );
};
