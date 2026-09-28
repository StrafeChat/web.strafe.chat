import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import { createGroupPM } from '../api/rooms';
import { addOrUpdateRoom } from '../stores/rooms';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { MessageAvatar } from './messageList/MessageAvatar';
import { FieldError, fieldLabelClass } from './ui/Input';
import { appDialogActions } from '../theme/appChrome';
import { t } from '../i18n';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateGroupModal: Component<CreateGroupModalProps> = (props) => {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const friends = () => relationships.relationships.filter((r) => r.type === RelType.Friend);

  function toggleFriend(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError('');
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const ids = [...selectedIds()];
    setError('');
    if (ids.length === 0) {
      setError(t('createGroup.selectOne'));
      return;
    }
    setLoading(true);
    try {
      const room = await createGroupPM({ recipient_ids: ids });
      addOrUpdateRoom(room);
      props.onClose();
      setSelectedIds(new Set<string>());
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createGroup.failed'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading()) {
      props.onClose();
      setError('');
      setSelectedIds(new Set<string>());
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="sm"
        onClose={handleClose}
        dismissible={!loading()}
        title={t('createGroup.title')}
        description={t('createGroup.description')}
      >
        <form onSubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col gap-4">
          <div class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <div class="flex items-center justify-between">
              <span class={fieldLabelClass}>{t('home.addFriends')}</span>
              <Show when={selectedIds().size > 0}>
                <span class="text-xs text-muted-foreground">{t('createGroup.selected', { count: selectedIds().size })}</span>
              </Show>
            </div>
            <div class="max-h-56 min-h-0 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
              <Show
                when={friends().length === 0}
                fallback={
                  <For each={friends()}>
                    {(rel) => {
                      const selected = () => selectedIds().has(rel.user.id);
                      return (
                        <label
                          class={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                            selected() ? 'bg-primary/15' : 'hover:bg-accent/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected()}
                            onChange={() => toggleFriend(rel.user.id)}
                            class="size-4 shrink-0 cursor-pointer rounded accent-primary"
                          />
                          <MessageAvatar name={friendDisplayName(rel)} avatar={rel.user.avatar} class="size-8 text-[13px]" />
                          <span class="min-w-0 flex-1">
                            <span class="block truncate text-sm text-foreground">{friendDisplayName(rel)}</span>
                            <span class="block truncate text-xs text-muted-foreground">@{rel.user.username}</span>
                          </span>
                        </label>
                      );
                    }}
                  </For>
                }
              >
                <p class="px-2 py-3 text-center text-sm text-muted-foreground">{t('createGroup.noFriends')}</p>
              </Show>
            </div>
            <FieldError message={error() || undefined} />
          </div>
          <div class={`${appDialogActions} shrink-0`}>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading()} disabled={selectedIds().size === 0}>
              {t('createGroup.title')}
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
