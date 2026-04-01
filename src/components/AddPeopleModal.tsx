import type { Component } from 'solid-js';
import { createSignal, For, Show, createEffect } from 'solid-js';
import { Portal } from 'solid-js/web';
import { relationships, RelType, friendDisplayName } from '../stores/relationships';
import { addRoomParticipant } from '../api/rooms';
import { Button } from './ui/Button';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

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
    relationships.relationships.filter(
      (r) => r.type === RelType.Friend && !inRoom().has(r.user.id)
    );

  async function handleAdd(userId: string) {
    setError('');
    setLoading(userId);
    try {
      await addRoomParticipant(props.roomId, userId);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
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
          ariaLabelledby="add-people-title"
          onBackdropClick={() => handleClose()}
          panelClass="flex min-h-0 w-full flex-col px-6 pt-6 touch-manipulation"
        >
          <h3 id="add-people-title" class="text-lg font-semibold text-foreground mb-1">Add people</h3>
          <p class="text-sm text-muted-foreground mb-4">Choose a friend to add to this group.</p>
          <div class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <Show when={friendsNotInRoom().length === 0} fallback={
              <div class="overflow-y-auto min-h-0 space-y-1 max-h-64">
                <For each={friendsNotInRoom()}>
                  {(rel) => (
                    <div class="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="size-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                          {friendDisplayName(rel)[0].toUpperCase()}
                        </div>
                        <span class="text-sm truncate">{friendDisplayName(rel)}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAdd(rel.user.id)}
                        disabled={loading() !== null}
                        loading={loading() === rel.user.id}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            }>
              <p class="text-sm text-muted-foreground py-2">No friends left to add. Everyone in your friends list is already in this group.</p>
            </Show>
            {error() && <p class="text-xs text-destructive mt-2">{error()}</p>}
            <div class="mt-4 shrink-0">
              <Button type="button" variant="outline" class="w-full" onClick={handleClose} disabled={loading() !== null}>
                Close
              </Button>
            </div>
          </div>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
