import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { createSpace } from '../api/spaces';
import { addOrUpdateSpace } from '../stores/spaces';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

interface CreateSpaceModalProps {
  open: boolean;
  onClose: () => void;
}

export const CreateSpaceModal: Component<CreateSpaceModalProps> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    try {
      const space = await createSpace({
        name: n,
        description: description().trim() || undefined,
      });
      addOrUpdateSpace(space);
      props.onClose();
      setName('');
      setDescription('');
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading()) {
      props.onClose();
      setError('');
      setName('');
      setDescription('');
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
          size="md"
          zClass="z-[220]"
          ariaLabelledby="create-space-title"
          onBackdropClick={() => handleClose()}
          panelClass="flex w-full flex-col gap-4 px-6 pt-6 touch-manipulation"
        >
          <h2 id="create-space-title" class="text-lg font-semibold text-foreground">
            Create a space
          </h2>
          <p class="text-sm text-muted-foreground">
            Spaces are servers where you can chat with others in rooms.
          </p>
          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <label for="create-space-name" class="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="create-space-name"
                type="text"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value);
                  setError('');
                }}
                placeholder="My space"
                maxLength={100}
                disabled={loading()}
                autofocus
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="create-space-desc" class="text-sm font-medium text-foreground">
                Description (optional)
              </label>
              <Input
                id="create-space-desc"
                type="text"
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                placeholder="What's this space about?"
                maxLength={500}
                disabled={loading()}
              />
            </div>
            <Show when={error()}>
              <p class="text-sm text-destructive">{error()}</p>
            </Show>
            <div class="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading()}>
                {loading() ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
