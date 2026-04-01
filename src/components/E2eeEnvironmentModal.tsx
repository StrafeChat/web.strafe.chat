import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { recoveryPin, setRecoveryPin } from '../stores/recoveryPin';
import { ResponsiveDialog } from './ui/ResponsiveDialog';

export const E2eeEnvironmentModal: Component = () => {
  const message = () => recoveryPin.e2eeEnvironmentError;

  function dismiss() {
    setRecoveryPin('e2eeEnvironmentError', null);
  }

  return (
    <Show when={message()}>
      <Portal mount={document.body}>
        <ResponsiveDialog
          size="md"
          zClass="z-[260]"
          ariaLabelledby="e2ee-env-title"
          onBackdropClick={() => dismiss()}
          panelClass="px-6 pt-6 touch-manipulation"
        >
          <h3 id="e2ee-env-title" class="mb-2 text-lg font-semibold text-foreground">
            Encryption unavailable in this browser tab
          </h3>
          <p class="text-sm text-muted-foreground mb-4 whitespace-pre-line">{message()}</p>
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            onClick={() => dismiss()}
          >
            Dismiss
          </button>
        </ResponsiveDialog>
      </Portal>
    </Show>
  );
};
