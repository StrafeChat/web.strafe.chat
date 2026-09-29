import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import type { SpaceRoom } from '../../../api/spaces';
import { auth } from '../../../stores/auth';
import { messages } from '../../../stores/messages';
import { rooms } from '../../../stores/rooms';
import { getUnreadCountForDisplay, readState } from '../../../stores/readState';
import { isRoomMuted } from '../../../lib/roomNotify';
import { MIME_STRAFE_ROOM_REORDER, type ReorderPayload } from '../../../lib/roomReorder';
import { appCompactRow, appCompactRowActive, appCompactRowIdle } from '../../../theme/appChrome';
import { roomTypeIcon } from './RoomTypeIcon';
import { instance } from '../../../stores/instance';
import { isConnectedTo, joinVoiceRoom, voiceStatesForRoom } from '../../../stores/voice';
import { voicePermsFor } from '../../../lib/voice/perms';
import { VoiceChannelUsers } from '../../voice/VoiceChannelUsers';
import { t } from '../../../i18n';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;

export interface SpaceChannelRowProps {
  room: SpaceRoom;
  spaceId: string;
  activeRoomId: string | undefined;
  onContextMenu: (e: MouseEvent, room: SpaceRoom) => void;
  /** When set with `reorderEnabled`, row participates in HTML5 reorder for this scope only. */
  reorderScopeKey?: string;
  reorderEnabled?: boolean;
  onReorderDragActive?: (info: ReorderPayload) => void;
  onReorderDragOverTarget?: (e: DragEvent, roomId: string) => void;
  onReorderDrop?: (e: DragEvent, targetId: string) => void;
  /** True while this row is the item being dragged (same scope). */
  reorderDragSource?: () => boolean;
  /** Hover actions on the row, shown only when the viewer has the permission. Passing the
   * callback is what reveals the button (the parent gates it), Discord-style. */
  onEditRoom?: (room: SpaceRoom) => void;
  onInvite?: (room: SpaceRoom) => void;
}

/** Text/voice row (shared by top-level channels and channels inside sections). */
export const SpaceChannelRow: Component<SpaceChannelRowProps> = (props) => {

  let suppressLinkNav = false;
  const list = () => messages.byRoom[props.room.id] ?? [];
  const roomMeta = () => {
    const m = rooms.rooms.find((x) => x.id === props.room.id) ?? props.room;
    return { ...m, space_id: m.space_id ?? props.spaceId };
  };
  const uid = () => auth.user?.id ?? '';
  const isTextChannel = () => props.room.type === ROOM_TYPE_TEXT;
  /** Server-authoritative count (room_mention_counts) - real for every room, not just loaded ones. */
  const mentions = () => {
    if (!isTextChannel()) return 0;
    return readState.byRoom[props.room.id]?.mentionCount ?? 0;
  };
  const baseUnread = () => {
    if (!uid() || !isTextChannel()) return 0;
    if (props.activeRoomId === props.room.id) return 0;
    return getUnreadCountForDisplay(props.room.id, roomMeta(), list(), uid());
  };
  const muted = () => isRoomMuted(props.room);
  const reorderOn = () => !!(props.reorderEnabled && props.reorderScopeKey && props.onReorderDrop);
  function handleReorderDragStart(e: DragEvent) {
    if (!reorderOn() || !props.reorderScopeKey) return;
    e.dataTransfer?.setData(
      MIME_STRAFE_ROOM_REORDER,
      JSON.stringify({ kind: 'channel', scopeKey: props.reorderScopeKey, id: props.room.id })
    );
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    props.onReorderDragActive?.({ kind: 'channel', scopeKey: props.reorderScopeKey!, id: props.room.id });
  }
  function handleReorderDragOver(e: DragEvent) {
    if (!reorderOn()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    props.onReorderDragOverTarget?.(e, props.room.id);
  }
  function handleReorderDrop(e: DragEvent) {
    if (!reorderOn() || !props.reorderScopeKey || !props.onReorderDrop) return;
    e.preventDefault();
    props.onReorderDrop(e, props.room.id);
  }
  function handleReorderDragEnd() {
    suppressLinkNav = true;
    queueMicrotask(() => {
      suppressLinkNav = false;
    });
  }
  const reorderSource = () => props.reorderDragSource?.() ?? false;
  const isVoice = () => props.room.type === ROOM_TYPE_VOICE;
  const voiceCount = () => (isVoice() ? voiceStatesForRoom(props.room.id).length : 0);
  const canConnect = () => voicePermsFor(uid(), props.spaceId, props.room.id).connect;
  /** Clicking a voice room joins it (Discord's behaviour) as well as opening its view. */
  function handleVoiceClick() {
    if (!isVoice() || !instance.voiceEnabled || isConnectedTo(props.room.id) || !canConnect()) return;
    void joinVoiceRoom(props.room.id).catch((err) => console.warn('[voice] join from sidebar failed', err));
  }
  return (
    <>
    <A
      href={`/spaces/${props.spaceId}/rooms/${props.room.id}`}
      class={`group/room ${appCompactRow} ${
        reorderSource()
          ? 'bg-muted/60 text-muted-foreground ring-1 ring-inset ring-dashed ring-primary/35'
          : props.activeRoomId === props.room.id
            ? appCompactRowActive
            : appCompactRowIdle
      }`}
      draggable={reorderOn()}
      onDragStart={handleReorderDragStart}
      onDragOver={handleReorderDragOver}
      onDrop={handleReorderDrop}
      onDragEnd={handleReorderDragEnd}
      onClick={(e) => {
        if (suppressLinkNav) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        handleVoiceClick();
      }}
      onContextMenu={(e) => props.onContextMenu(e, props.room)}
    >
      {roomTypeIcon(props.room)}
      <Show when={baseUnread() > 0 && mentions() === 0 && !muted()}>
        <span class="w-1.5 h-1.5 rounded-full bg-primary" />
      </Show>
      <span
        class={`truncate min-w-0 flex-1 ${
          (baseUnread() > 0 || mentions() > 0) && !muted() ? 'font-semibold text-foreground' : ''
        }`}
      >
        {props.room.name || 'unnamed'}
      </span>
      {/* Hover actions (invite + settings). Shown only when the parent passes the handler, i.e.
          the viewer has the permission. The name is flex-1, so these shrink it on hover rather
          than shoving the unread/mention indicators. Inside the <A>, so each stops navigation. */}
      <Show when={props.onInvite || props.onEditRoom}>
        <span
          class={`shrink-0 items-center gap-0.5 ps-1 ${
            props.activeRoomId === props.room.id ? 'flex' : 'hidden group-hover/room:flex'
          }`}
        >
          <Show when={props.onInvite}>
            <button
              type="button"
              class="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('space.inviteMembers')}
              data-tooltip={t('space.inviteMembers')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.onInvite!(props.room);
              }}
            >
              <i class="fa-solid fa-user-plus text-[11px]" aria-hidden="true" />
            </button>
          </Show>
          <Show when={props.onEditRoom}>
            <button
              type="button"
              class="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t('space.roomSettings')}
              data-tooltip={t('space.roomSettings')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.onEditRoom!(props.room);
              }}
            >
              <i class="fa-solid fa-gear text-[11px]" aria-hidden="true" />
            </button>
          </Show>
        </span>
      </Show>
      <Show when={muted()}>
        <i class="fa-solid fa-bell-slash shrink-0 text-[10px] text-muted-foreground/70" aria-hidden="true" />
      </Show>
      <Show when={isVoice() && (voiceCount() > 0 || (props.room.user_limit ?? 0) > 0)}>
        <span class="shrink-0 text-[10px] tabular-nums text-muted-foreground/80">
          <i class="fa-solid fa-user me-0.5 text-[9px]" aria-hidden="true" />
          {voiceCount()}
          <Show when={(props.room.user_limit ?? 0) > 0}>/{props.room.user_limit}</Show>
        </span>
      </Show>
      <Show when={mentions() > 0 && !muted()}>
        <span class="shrink-0 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1.5">
          {mentions() > 99 ? '99+' : mentions()}
        </span>
      </Show>
    </A>
    <Show when={isVoice()}>
      <VoiceChannelUsers roomId={props.room.id} spaceId={props.spaceId} />
    </Show>
    </>
  );
};
