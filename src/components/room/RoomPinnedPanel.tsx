import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { getMessageBodyText, getSenderDisplay } from '../messageList';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { MessageBody } from '../messageList/MessageBody';
import { MessageAttachments } from '../messageList/MessageAttachments';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { auth } from '../../stores/auth';
import { unpinMessage } from '../../stores/pinnedMessages';
import { appFloatPanel, appSectionLabel } from '../../theme/appChrome';
import { EmptyState } from '../ui/EmptyState';
import { IconButton } from '../ui/IconButton';
import { openUserProfilePopover } from '../../stores/userProfilePopover';
import { popoverSubjectFromSender } from '../../lib/userProfilePopoverHelpers';
import { t } from '../../i18n';

export interface RoomPinnedPanelProps {
  roomId?: string;
  messages: DecryptedMessage[];
  participants?: RoomParticipant[];
  spaceRoles?: SpaceRole[];
  onSelectMessage: (messageId: string) => void;
}

export const RoomPinnedPanel: Component<RoomPinnedPanelProps> = (props) => {
  const currentUserId = () => auth.user?.id;

  return (
    <aside
      class={`flex max-h-[min(70vh,32rem)] w-80 flex-col overflow-hidden md:w-96 ${appFloatPanel}`}
      aria-label={t('room.pinned')}
    >
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 pb-3 pt-4">
        <h2 class={`${appSectionLabel} flex items-center gap-1.5`}>
          <i class="fa-solid fa-thumbtack text-[11px]" aria-hidden="true" />
          {t('room.pinned')}
        </h2>
        <Show when={props.messages.length > 0}>
          <span class="text-[11px] tabular-nums text-muted-foreground">{props.messages.length}</span>
        </Show>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <Show
          when={props.messages.length > 0}
          fallback={
            <EmptyState icon="fa-solid fa-thumbtack" body={t('room.pinnedEmpty')} />
          }
        >
          <div class="space-y-2">
            <For each={props.messages}>
              {(msg) => {
                const sender = () => getSenderDisplay(msg.sender_id, props.participants, currentUserId());
                const body = () => getMessageBodyText(msg);
                function openMentionProfile(userId: string, anchor: HTMLElement) {
                  const s = getSenderDisplay(userId, props.participants, currentUserId());
                  openUserProfilePopover({
                    anchor,
                    subject: popoverSubjectFromSender(s, { participant: props.participants?.find((x) => x.id === userId), spaceRoles: props.spaceRoles }),
                    currentUserId: currentUserId(),
                  });
                }
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    class="group/pin relative flex w-full gap-2.5 rounded-xl border border-border/80 bg-card/50 px-3 py-2.5 text-start text-xs transition-colors hover:bg-card/80"
                    onClick={() => props.onSelectMessage(msg.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        props.onSelectMessage(msg.id);
                      }
                    }}
                  >
                    <MessageAvatar name={sender().name} avatar={sender().avatar} class="size-8 shrink-0 text-[11px]" />
                    <div class="min-w-0 flex-1">
                      <div class="mb-0.5 flex items-baseline justify-between gap-2 pe-6">
                        <span class="truncate text-[13px] font-semibold text-foreground">{sender().name}</span>
                        <span class="shrink-0 text-[11px] text-muted-foreground">
                          {formatMessageTimestamp(new Date(msg.created_at))}
                        </span>
                      </div>
                      <div class="text-[13px] leading-relaxed text-foreground/90">
                        <MessageBody
                          text={body()}
                          participants={props.participants}
                          spaceRoles={props.spaceRoles}
                          onMentionClick={openMentionProfile}
                        />
                      </div>
                      <Show when={msg.attachments?.length}>
                        <MessageAttachments attachments={msg.attachments!} />
                      </Show>
                    </div>
                    <Show when={props.roomId}>
                      <IconButton
                        size="sm"
                        icon="fa-solid fa-xmark"
                        label={t('room.unpin')}
                        class="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-hover/pin:opacity-100 focus-visible:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (props.roomId) unpinMessage(props.roomId, msg.id);
                        }}
                      />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </div>
    </aside>
  );
};
