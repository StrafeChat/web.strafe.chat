import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import { addRoomParticipant } from '../api/rooms';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { MessageAvatar } from './messageList/MessageAvatar';
import { FieldError } from './ui/Input';
import { EmptyState } from './ui/EmptyState';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

interface AddPeopleModalProps {
  open: boolean;
  roomId: string;
  /** User IDs already in the room (to exclude from list) */
  participantIds: string[];
  onClose: () => void;
}

export const AddPeopleModal: Component<AddPeopleModalProps> = (props) => {
  const [loading, setLoading] = createSignal<string | null>(null);
  const [error, setError] = createSignal('');

  const inRoom = () => new Set(props.participantIds);
  const friendsNotInRoom = () =>
    relationships.relationships.filter((r) => r.type === RelType.Friend && !inRoom().has(r.user.id));

  async function handleAdd(userId: string) {
    setError('');
    setLoading(userId);
    try {
      await addRoomParticipant(props.roomId, userId);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addPeople.failed'));
    } finally {
      setLoading(null);
    }
  }

  function handleClose() {
    if (!loading()) {
      props.onClose();
      setError('');
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="sm"
        onClose={handleClose}
        dismissible={loading() === null}
        title={t('room.addPeople')}
        description={t('addPeople.description')}
      >
        <div class="flex min-h-0 flex-1 flex-col gap-4">
          <Show
            when={friendsNotInRoom().length === 0}
            fallback={
              <div class="max-h-64 min-h-0 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
                <For each={friendsNotInRoom()}>
                  {(rel) => (
                    <div class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
                      <div class="flex min-w-0 items-center gap-3">
                        <MessageAvatar name={friendDisplayName(rel)} avatar={rel.user.avatar} class="size-8 text-[13px]" />
                        <span class="min-w-0">
                          <span class="block truncate text-sm text-foreground">{friendDisplayName(rel)}</span>
                          <span class="block truncate text-xs text-muted-foreground">@{rel.user.username}</span>
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAdd(rel.user.id)}
                        disabled={loading() !== null}
                        loading={loading() === rel.user.id}
                      >
                        {t('common.add')}
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            }
          >
            <EmptyState icon="fa-solid fa-user-check" body={t('addPeople.everyoneAdded')} />
          </Show>
          <FieldError message={error() || undefined} />
          <div class={`${appDialogActions} shrink-0`}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading() !== null}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
