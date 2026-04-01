import type { Component } from 'solid-js';
import { createSignal, For, Show, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import { createGroupPM } from '../api/rooms';
import { addOrUpdateRoom } from '../stores/rooms';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

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
      setError('Select at least one friend');
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
      setError(err instanceof Error ? err.message : 'Failed to create group');
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

  createEffect(() => {
    if (!props.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="sm"
          zClass="z-[220]"
          ariaLabelledby="create-group-title"
          onBackdropClick={() => handleClose()}
          panelClass="flex min-h-0 w-full flex-col px-6 pt-6 touch-manipulation"
        >
          <h3 id="create-group-title" class="text-lg font-semibold text-foreground mb-1">Create group</h3>
          <p class="text-sm text-muted-foreground mb-4">Add friends to start a group conversation. The group will be named after its members.</p>
          <form onSubmit={handleSubmit} class="flex flex-col flex-1 min-h-0">
            <div class="mb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <label class="text-sm font-medium text-foreground mb-2 block">Add friends</label>
              <div class="overflow-y-auto min-h-0 rounded-md border border-border p-2 space-y-1 max-h-48">
                <Show when={friends().length === 0} fallback={
                  <For each={friends()}>
                    {(rel) => (
                      <label class="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedIds().has(rel.user.id)}
                          onChange={() => toggleFriend(rel.user.id)}
                          class="rounded border-input"
                        />
                        <div class="size-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                          {friendDisplayName(rel)[0].toUpperCase()}
                        </div>
                        <span class="text-sm truncate">{friendDisplayName(rel)}</span>
                      </label>
                    )}
                  </For>
                }>
                  <p class="text-sm text-muted-foreground py-2">No friends yet. Add friends from the Friends page first.</p>
                </Show>
              </div>
            </div>
            {error() && <p class="text-xs text-destructive mb-2">{error()}</p>}
            <div class="flex gap-2 shrink-0">
              <Button type="button" variant="outline" class="flex-1" onClick={handleClose} disabled={loading()}>
                Cancel
              </Button>
              <Button type="submit" class="flex-1" loading={loading()} disabled={selectedIds().size === 0}>
                Create
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
