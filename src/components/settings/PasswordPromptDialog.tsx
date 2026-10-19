import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { t } from '../../i18n';
import { translateCaughtApiError } from '../../lib/formatApiError';

function apiErrorText(err: unknown): string {
  return translateCaughtApiError(err, t).join(' ');
}

/**
 * "Enter your password to continue" - the step-up in front of a change that must not be
 * possible with a stolen session alone (turning 2FA off, removing a passkey, replacing the
 * message history backup). `onConfirm` runs the change; if it throws, the dialog stays open
 * and shows the error, so a wrong password is corrected in place.
 *
 * Rendered directly by settings pages, and by PasswordPromptHost for flows that run outside
 * the component tree (stores/passwordPrompt.ts).
 */
export const PasswordPromptDialog: Component<{
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  /**
   * An error the caller already knows about, shown until the user edits the field - a wrong
   * password reported by a previous attempt when the prompt is raised again.
   */
  error?: string;
  /** Stacking tier when raised over something other than the settings shell. */
  zClass?: string;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}> = (props) => {
  const [password, setPassword] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  // null until this dialog has something of its own to say (or the user starts typing), so
  // that the caller's error shows first and typing clears it like any other.
  const [ownError, setOwnError] = createSignal<string | null>(null);
  const error = () => ownError() ?? props.error ?? '';

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setOwnError('');
    if (!password()) return;
    setBusy(true);
    try {
      await props.onConfirm(password());
    } catch (err) {
      setOwnError(apiErrorText(err));
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      size="sm"
      zClass={props.zClass}
      onClose={props.onClose}
      closeButton
      dismissible={!busy()}
      title={props.title}
      description={props.description}
      icon="fa-solid fa-lock"
      tone={props.tone ?? 'default'}
    >
      <form onSubmit={handleSubmit} class="space-y-3">
        <Input
          type="password"
          label={t('settings.security.passwordPromptLabel')}
          value={password()}
          onInput={(e) => {
            setOwnError('');
            setPassword(e.currentTarget.value);
          }}
          autocomplete="current-password"
          autofocus
        />
        <Show when={error()}>
          <p class="text-xs text-destructive">{error()}</p>
        </Show>
        <Button type="submit" class="w-full" variant={props.tone === 'danger' ? 'destructive' : 'primary'} loading={busy()}>
          {props.confirmLabel}
        </Button>
      </form>
    </ResponsiveDialog>
  );
};
