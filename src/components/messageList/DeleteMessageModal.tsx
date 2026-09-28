import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import type { DecryptedMessage } from '../../stores/messages';
import type { RoomParticipant } from '../../api/rooms';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import { getMessageBodyText, getSenderDisplay } from './utils';
import { MessageAvatar } from './MessageAvatar';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { Button } from '../ui/Button';
import { appDialogActions } from '../../theme/appChrome';
import { t } from '../../i18n';

export interface DeleteMessageModalProps {
  pending: { roomId: string; msgId: string; message: DecryptedMessage } | null;
  participants?: RoomParticipant[];
  currentUserId: string | undefined;
  onConfirm: (roomId: string, msgId: string) => void;
  onCancel: () => void;
}

export const DeleteMessageModal: Component<DeleteMessageModalProps> = (props) => (
  <Show when={props.pending}>
    {(pd) => {
      const msg = () => pd().message;
      const sender = () => getSenderDisplay(msg().sender_id, props.participants, props.currentUserId);
      return (
        <ResponsiveDialog
          size="md"
          onClose={() => props.onCancel()}
          title={t('messages.actions.delete')}
          description={t('messages.deleteConfirm')}
          icon="fa-solid fa-trash"
          tone="danger"
        >
          <div class="mb-4 rounded-xl border border-border bg-card/50 p-3">
            <div class="flex gap-3">
              <MessageAvatar name={sender().name} avatar={sender().avatar} />
              <div class="min-w-0 flex-1">
                <div class="mb-0.5 flex flex-wrap items-baseline gap-2">
                  <span class="truncate text-sm font-semibold text-foreground">{sender().name}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {formatMessageTimestamp(new Date(msg().created_at))}
                  </span>
                </div>
                <p class="line-clamp-6 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {getMessageBodyText(msg())}
                </p>
              </div>
            </div>
          </div>
          <p class="mb-4 text-xs">
            <span class="font-semibold uppercase tracking-wide text-primary">{t('messages.protip')}</span>
            <span class="ms-1 text-muted-foreground">
              {t('messages.deleteProtipBefore')}{' '}
              <kbd class="rounded border border-border bg-muted/50 px-1 py-0.5 font-mono text-[10px] text-foreground">Shift</kbd>{' '}
              {t('messages.deleteProtipAfter')}
            </span>
          </p>
          <div class={appDialogActions}>
            <Button variant="outline" onClick={props.onCancel} data-autofocus>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => props.onConfirm(pd().roomId, pd().msgId)}>
              {t('common.delete')}
            </Button>
          </div>
        </ResponsiveDialog>
      );
    }}
  </Show>
);
