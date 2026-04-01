import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';

export interface RenameGroupModalProps {
  open: boolean;
  currentName: string;
  /** E2EE enabled (default true). Only group creator can change. */
  currentE2eeEnabled?: boolean;
  onSave: (opts: { name: string; e2ee_enabled: boolean }) => void | Promise<void>;
  onClose: () => void;
}

export const RenameGroupModal: Component<RenameGroupModalProps> = (props) => {
  const [name, setName] = createSignal(props.currentName);
  const [e2eeEnabled, setE2eeEnabled] = createSignal(props.currentE2eeEnabled !== false);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  createEffect(() => {
    if (props.open) {
      setName(props.currentName);
      setE2eeEnabled(props.currentE2eeEnabled !== false);
      setError('');
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    const n = name().trim();
    setError('');
    if (!n) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    Promise.resolve(props.onSave({ name: n, e2ee_enabled: e2eeEnabled() }))
      .then(() => props.onClose())
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to save'))
      .finally(() => setLoading(false));
  }

  function handleClose() {
    if (!loading()) {
      setName(props.currentName);
      setE2eeEnabled(props.currentE2eeEnabled !== false);
      setError('');
      props.onClose();
    }
  }

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="sm"
          zClass="z-[220]"
          ariaLabelledby="rename-group-title"
          onBackdropClick={() => handleClose()}
          panelClass="px-6 pt-6 touch-manipulation"
        >
          <h2 id="rename-group-title" class="text-lg font-semibold text-foreground mb-1">Group settings</h2>
          <p class="text-sm text-muted-foreground mb-4">Edit the group name and whether messages are end-to-end encrypted.</p>
          <form onSubmit={handleSubmit} class="space-y-4">
            <Input
              type="text"
              label="Group name"
              placeholder="e.g. Weekend squad"
              value={name()}
              onInput={(e) => { setName(e.currentTarget.value); setError(''); }}
              disabled={loading()}
            />
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={e2eeEnabled()}
                onInput={(e) => setE2eeEnabled((e.target as HTMLInputElement).checked)}
                disabled={loading()}
                class="rounded border-border"
              />
              <span class="text-sm text-foreground">End-to-end encryption</span>
            </label>
            <p class="text-xs text-muted-foreground">When off, messages are stored in plaintext in our servers.</p>
            {error() && <p class="text-xs text-destructive">{error()}</p>}
            <div class="flex gap-2">
              <Button type="button" variant="outline" class="flex-1" onClick={handleClose} disabled={loading()}>
                Cancel
              </Button>
              <Button type="submit" class="flex-1" loading={loading()} disabled={!name().trim()}>
                Save
              </Button>
            </div>
          </form>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
