import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { cancelPasswordPrompt, passwordPromptState, submitPasswordPrompt } from '../stores/passwordPrompt';
import { PasswordPromptDialog } from './settings/PasswordPromptDialog';
import { zLayer } from '../theme/appChrome';

/** Renders whatever `promptPassword()` is currently asking. Mounted once in the root layout. */
export const PasswordPromptHost: Component = () => (
  <Show when={passwordPromptState.pending}>
    {(pending) => {
      const opts = () => pending().options;
      return (
        <PasswordPromptDialog
          title={opts().title}
          description={opts().description}
          confirmLabel={opts().confirmLabel}
          tone={opts().tone}
          error={passwordPromptState.lastSubmitError ?? undefined}
          // Raised from the settings shell as well as from bootstrap, so above the former.
          zClass={zLayer.confirm}
          onConfirm={(password) => {
            submitPasswordPrompt(password);
            return Promise.resolve();
          }}
          onClose={cancelPasswordPrompt}
        />
      );
    }}
  </Show>
);
