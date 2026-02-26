import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { recoveryPin, submitRecoveryPin } from '../stores/recoveryPin';

export const RecoveryPinModal: Component = () => {
  const [pin, setPin] = createSignal('');
  const [error, setError] = createSignal('');

  const pending = () => recoveryPin.pending;

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
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-modal>
        <div class="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg border border-border">
          <h3 class="text-lg font-semibold text-foreground mb-1">
            {pending()!.mode === 'restore'
              ? 'Restore your messages'
              : 'Set up recovery PIN'}
          </h3>
          <p class="text-sm text-muted-foreground mb-4">
            {pending()!.mode === 'restore'
              ? 'Enter your recovery PIN to decrypt messages on this device.'
              : 'Create a 6-digit PIN to access your messages on other devices.'}
          </p>
          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <input
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="one-time-code"
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
        </div>
      </div>
    </Show>
  );
};
