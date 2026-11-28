import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import type { ForwardView } from '../../lib/forwardMessages';
import { openRoomLink } from '../../lib/openRoomLink';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { spaces } from '../../stores/spaces';
import { t } from '../../i18n';
import { MessageAttachments } from './MessageAttachments';
import { MessageBody } from './MessageBody';
import { MessageEmbeds } from './MessageEmbed';

/**
 * A forwarded message (lib/forwardMessages): a "Forwarded" label over the copy - its text,
 * files and embeds as they were, never who wrote them (Discord leaves the author out too) -
 * with where and when it came from. That line opens the original when this account can see
 * its room; otherwise it says it is not available, as any room link does.
 */
export const ForwardedMessage: Component<{
  forward: ForwardView;
  participants?: RoomParticipant[];
  spaceRoles?: SpaceRole[];
  onMentionClick?: (userId: string, anchor: HTMLElement) => void;
}> = (props) => {
  const f = () => props.forward;
  const sourceRoomName = () => {
    const src = f().source;
    if (!src?.roomId || src.domain) return '';
    const sid = src.spaceId;
    const list = sid ? spaces.spaceRoomsBySpaceId[sid] : undefined;
    return list?.find((r) => r.id === src.roomId)?.name ?? '';
  };
  const canOpen = () => {
    const src = f().source;
    return !!src?.roomId && !!src.messageId && !src.domain;
  };
  const when = () => {
    const d = new Date(f().timestamp);
    return Number.isNaN(d.getTime()) ? '' : formatMessageTimestamp(d);
  };
  const open = () => {
    const src = f().source;
    if (!src?.roomId || !src.messageId) return;
    void openRoomLink({ roomId: src.roomId, spaceId: src.spaceId ?? null, messageId: src.messageId });
  };

  return (
    <div class="mt-0.5 flex max-w-[min(40rem,100%)] flex-col gap-1" data-forwarded-message>
      <div class="flex items-center gap-1.5 text-xs italic text-muted-foreground">
        <i class="fa-solid fa-share text-[11px]" aria-hidden="true" />
        <span>{t('forward.label')}</span>
      </div>
      <div class="flex min-w-0 flex-col gap-1.5 border-s-[3px] border-border ps-3">
        <Show when={f().content}>
          <div class="break-words text-sm text-foreground/90">
            <MessageBody
              text={f().content}
              embedded
              participants={props.participants}
              spaceRoles={props.spaceRoles}
              onMentionClick={props.onMentionClick}
            />
          </div>
        </Show>
        <Show when={f().attachments.length}>
          <MessageAttachments attachments={f().attachments} />
        </Show>
        <Show when={f().embeds.length}>
          <MessageEmbeds embeds={f().embeds} participants={props.participants} spaceRoles={props.spaceRoles} onMentionClick={props.onMentionClick} />
        </Show>
        <div class="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Show
            when={canOpen()}
            fallback={<span>{when()}</span>}
          >
            <button
              type="button"
              class="truncate hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              onClick={open}
              title={t('forward.openOriginal')}
            >
              {sourceRoomName() ? t('forward.from', { room: sourceRoomName(), time: when() }) : t('forward.fromTime', { time: when() })}
            </button>
          </Show>
          <Show when={f().editedTimestamp}>
            <span>· {t('messages.edited')}</span>
          </Show>
        </div>
      </div>
    </div>
  );
};
