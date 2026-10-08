import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import type { SpaceRoom } from '../../../api/spaces';
import { auth } from '../../../stores/auth';
import { messages } from '../../../stores/messages';
import { getUnreadCountForDisplay, readState } from '../../../stores/readState';
import { isRoomMuted } from '../../../lib/roomNotify';
import { appCompactRow, appCompactRowActive, appCompactRowIdle } from '../../../theme/appChrome';

/**
 * A thread nested under its channel in the sidebar, the way Discord lists the active threads
 * you are in: indented, a thread icon instead of the hash, the same unread and mention
 * treatment as a channel row.
 */
export const SpaceThreadRow: Component<{
  room: SpaceRoom;
  spaceId: string;
  activeRoomId: string | undefined;
  onContextMenu: (e: MouseEvent, room: SpaceRoom) => void;
}> = (props) => {
  const uid = () => auth.user?.id ?? '';
  const active = () => props.activeRoomId === props.room.id;
  const mentions = () => readState.byRoom[props.room.id]?.mentionCount ?? 0;
  const unread = () => {
    if (!uid() || active()) return 0;
    return getUnreadCountForDisplay(
      props.room.id,
      { ...props.room, space_id: props.room.space_id ?? props.spaceId },
      messages.byRoom[props.room.id] ?? [],
      uid()
    );
  };
  const muted = () => isRoomMuted(props.room);
  const highlight = () => !active() && !muted() && (unread() > 0 || mentions() > 0);
  return (
    <A
      href={`/spaces/${props.spaceId}/rooms/${props.room.id}`}
      class={`relative ms-4 ${appCompactRow} ${active() ? appCompactRowActive : appCompactRowIdle}`}
      onContextMenu={(e) => props.onContextMenu(e, props.room)}
      title={props.room.name}
    >
      <Show when={highlight()}>
        <span class="pointer-events-none absolute -left-3 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-full bg-foreground" aria-hidden="true" />
      </Show>
      <i class="fa-solid fa-comments shrink-0 text-[11px] text-muted-foreground/80" aria-hidden="true" />
      <span class={`min-w-0 flex-1 truncate text-[13px] ${highlight() ? 'font-semibold text-foreground' : ''}`}>{props.room.name}</span>
      <Show when={props.room.thread?.locked}>
        <i class="fa-solid fa-lock shrink-0 text-[9px] text-muted-foreground/70" aria-hidden="true" />
      </Show>
      <Show when={muted()}>
        <i class="fa-solid fa-bell-slash shrink-0 text-[10px] text-muted-foreground/70" aria-hidden="true" />
      </Show>
      <Show when={mentions() > 0 && !active()}>
        <span class="flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {mentions()}
        </span>
      </Show>
    </A>
  );
};
