import type { Component } from 'solid-js';
import { createSignal, For, Show, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import { createGroupPM } from '../api/rooms';
import { addOrUpdateRoom } from '../stores/rooms';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateGroupModal: Component<CreateGroupModalProps> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
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
    const n = name().trim();
    const ids = [...selectedIds()];
    setError('');
    if (!n) {
      setError('Group name is required');
      return;
    }
    if (ids.length === 0) {
      setError('Select at least one friend');
      return;
    }
    setLoading(true);
    try {
      const room = await createGroupPM({ name: n, recipient_ids: ids });
      addOrUpdateRoom(room);
      props.onClose();
      setName('');
      setSelectedIds(new Set());
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
      setName('');
      setSelectedIds(new Set());
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
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        data-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-group-title"
        onClick={handleClose}
      >
        <div
          class="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg border border-border mx-4 max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="create-group-title" class="text-lg font-semibold text-foreground mb-1">Create group</h3>
          <p class="text-sm text-muted-foreground mb-4">Add friends to a new group conversation.</p>
          <form onSubmit={handleSubmit} class="flex flex-col flex-1 min-h-0">
            <div class="mb-4">
              <Input
                type="text"
                label="Group name"
                placeholder="e.g. Weekend squad"
                value={name()}
                onInput={(e) => { setName(e.currentTarget.value); setError(''); }}
                disabled={loading()}
              />
            </div>
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
              <Button type="submit" class="flex-1" loading={loading()} disabled={friends().length === 0}>
                Create
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};
