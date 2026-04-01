import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { recoveryPin, submitRecoveryPin } from '../stores/recoveryPin';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

export const RecoveryPinModal: Component = () => {
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');

  const pending = () => recoveryPin.pending;
  const submitError = () => recoveryPin.lastSubmitError;

  function handleSubmit(e: Event) {
    e.preventDefault();
    const value = pin().trim();
    if (value.length < 6) {
      setError('PIN must be at least 6 digits');
      return;
    }
    setError('');
    setPin('');
    submitRecoveryPin(value);
  }

  function handleCancel() {
    setError('');
    setPin('');
    submitRecoveryPin(null);
  }

  return (
    <Show when={pending()}>
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="sm"
          zClass="z-[250]"
          ariaLabelledby="recovery-pin-title"
          onBackdropClick={() => handleCancel()}
          panelClass="px-6 pt-6 touch-manipulation"
        >
          <h3 id="recovery-pin-title" class="mb-1 text-lg font-semibold text-foreground">
            {pending()!.mode === 'restore'
              ? 'Restore your messages'
              : 'Set up recovery PIN'}
          </h3>
          <p class="text-sm text-muted-foreground mb-4">
            {pending()!.mode === 'restore'
              ? 'Your PIN is not stored on the server — it only unlocks an encrypted backup. Keys are saved in this browser (IndexedDB), not in localStorage.'
              : 'Create a 6-digit PIN to encrypt a backup of your keys on the server. Keys stay in this browser (IndexedDB).'}
          </p>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck={false}
                placeholder="6+ digit PIN"
                class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={pin()}
                onInput={(e) => {
                  setPin((e.target as HTMLInputElement).value);
                  setError('');
                }}
                maxlength={12}
              />
              {error() && (
                <p class="mt-1 text-xs text-destructive">{error()}</p>
              )}
              {submitError() && (
                <p class="mt-1 text-xs text-destructive">{submitError()}</p>
              )}
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                {pending()!.mode === 'restore' ? 'Restore' : 'Create backup'}
              </button>
            </div>
          </form>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
