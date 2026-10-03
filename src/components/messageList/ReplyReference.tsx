import type { Component } from 'solid-js';
import { Show, createMemo } from 'solid-js';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import { getMessageBodyText, getSenderDisplay, messagePreviewText } from './utils';
import { MessageAvatar } from './MessageAvatar';
import { scrollToMessage } from '../../lib/utils/messages';
import { t } from '../../i18n';
import { BotTag } from '../BotTag';

export interface ReplyReferenceProps {
  replyToId: string;
  messages: DecryptedMessage[];
  /** The replied-to message embedded on the parent (server `referenced_message`), used when it
   * isn't in the loaded list - so a reply to older history still shows author + preview instead
   * of "original unavailable". For an E2EE room it carries ciphertext only, so the text falls
   * back to the loading placeholder; the author still resolves. */
  referenced?: DecryptedMessage;
  participants?: RoomParticipant[];
  currentUserId?: string;
  /** Compact mode has no avatar gutter, so show a reply glyph instead of relying on the spine. */
  compact?: boolean;
}

const PREVIEW_MAX = 90;

/**
 * The "replying to …" line above a message (Discord-style): small avatar, author, one-line
 * preview; click to jump. The curved spine that connects it to the message's avatar is
 * drawn by the message row itself, in the avatar gutter.
 */
export const ReplyReference: Component<ReplyReferenceProps> = (props) => {
  const replied = createMemo(() => props.messages.find((m) => m.id === props.replyToId) ?? props.referenced);
  const sender = createMemo(() => {
    const r = replied();
    return r ? getSenderDisplay(r.sender_id, props.participants, props.currentUserId) : null;
  });
  const preview = createMemo(() => {
    const r = replied();
    if (!r) return '';
    return messagePreviewText(getMessageBodyText(r), props.participants, props.currentUserId, PREVIEW_MAX);
  });

  return (
    <div class="mb-1 flex h-5 min-w-0 items-center gap-1.5 text-xs">
      <Show when={props.compact}>
        <i class="fa-solid fa-reply -scale-x-100 text-[10px] text-muted-foreground" aria-hidden="true" />
      </Show>
      <Show
        when={replied()}
        fallback={
          <span class="flex min-w-0 items-center gap-1.5 italic text-muted-foreground">
            <span class="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted">
              <i class="fa-solid fa-ban text-[9px]" aria-hidden="true" />
            </span>
            <span class="truncate">{t('messages.replyMissing')}</span>
          </span>
        }
      >
        <button
          type="button"
          class="group/reply flex min-w-0 items-center gap-1.5 rounded text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t('messages.replyJump')}
          onClick={(e) => {
            e.stopPropagation();
            scrollToMessage(props.replyToId);
          }}
        >
          <MessageAvatar name={sender()!.name} avatar={sender()!.avatar} class="size-4 text-[9px] ring-0" />
          <span class="shrink-0 font-semibold text-foreground/90 group-hover/reply:underline">{sender()!.name}</span>
          <BotTag bot={sender()!.bot} size="xs" class="ms-0" />
          <span class="min-w-0 truncate text-muted-foreground group-hover/reply:text-foreground/80">
            {preview() || <span class="italic">{t('messages.noText')}</span>}
          </span>
        </button>
      </Show>
    </div>
  );
};
