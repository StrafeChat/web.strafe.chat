import type { Component } from 'solid-js';
import { For } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import { PresenceDot } from '../PresenceDot';
import { showContextMenu } from '../../stores/contextMenu';

export interface RoomMembersSidebarProps {
  participants: RoomParticipant[];
  currentUserId: string | undefined;
  onMessageUser: (userId: string) => void;
}

export const RoomMembersSidebar: Component<RoomMembersSidebarProps> = (props) => (
  <aside
    class="w-60 shrink-0 border-l border-border bg-[hsl(0_0%_8%)] flex flex-col overflow-hidden hidden md:flex"
    aria-label="Group members"
  >
    <div class="px-3 pt-4 shrink-0">
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Members — {props.participants.length}
      </h2>
    </div>
    <div class="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
      <For each={props.participants}>
        {(p) => {
          const displayName = () => p.display_name || p.username || 'Unknown';
          const isSelf = () => p.id === props.currentUserId;
          return (
            <div
              class="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/30 transition-colors cursor-context-menu"
              onContextMenu={(e) => {
                if (isSelf()) return;
                const tag =
                  p.discriminator != null
                    ? `${p.username}#${String(p.discriminator).padStart(4, '0')}`
                    : `@${p.username}`;
                showContextMenu(e, [
                  {
                    label: 'Message',
                    icon: 'fa-message',
                    onClick: () => props.onMessageUser(p.id),
                  },
                  {
                    label: 'Copy username',
                    icon: 'fa-copy',
                    onClick: () => navigator.clipboard.writeText(tag),
                  },
                ]);
              }}
            >
              <div class="relative shrink-0">
                <div class="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {displayName()[0].toUpperCase()}
                </div>
                <span class="absolute bottom-[-1px] right-[-1px]">
                  <PresenceDot userId={p.id} class="size-3.5" />
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium truncate">{displayName()}</p>
                <p class="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  </aside>
);
