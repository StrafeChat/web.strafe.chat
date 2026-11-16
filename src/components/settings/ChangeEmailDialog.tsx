import type { Component } from 'solid-js';
import { createSignal, Show, untrack } from 'solid-js';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { t } from '../../i18n';
import { translateCaughtApiError } from '../../lib/formatApiError';
import { EMAIL_RE } from '../../lib/emailChange';
import { isApiError } from '../../api/ApiError';
import type { EmailChangeInput, EmailState } from '../../api/users';
import { submitEmailChange } from '../../stores/accountEmail';

/**
 * Settings → Security → Email → Change. Asks for the new address and re-authenticates: the
 * current password, plus an authenticator or recovery code when the account has a second
 * factor. Passkeys can't be used for this step-up (not in v1, and never in the desktop or
 * mobile apps), so a passkey-only account enters a recovery code.
 *
 * With email on, the server sends a confirmation link to the new address and nothing changes
 * until it is opened (`onDone(state, true)`); without it the change applies at once,
 * unverified (`onDone(state, false)`).
 */
export const ChangeEmailDialog: Component<{
  currentEmail: string;
  mailEnabled: boolean;
  totpEnabled: boolean;
  hasPasskeys: boolean;
  onDone: (state: EmailState, sent: boolean) => void;
  onClose: () => void;
}> = (props) => {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [code, setCode] = createSignal('');
  // A passkey-only account has no authenticator codes, only recovery codes. The starting
  // mode only; the toggle owns it from then on.
  const [useRecovery, setUseRecovery] = createSignal(untrack(() => !props.totpEnabled && props.hasPasskeys));
  // The server said a second factor is needed though the status we had said none (it changed
  // in another session): show the field from then on.
  const [mfaRevealed, setMfaRevealed] = createSignal(false);
  const [emailErr, setEmailErr] = createSignal('');
  const [passwordErr, setPasswordErr] = createSignal('');
  const [codeErr, setCodeErr] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const showCode = () => props.totpEnabled || props.hasPasskeys || mfaRevealed();
  // Authenticator codes are offered unless we know the only factor is a passkey.
  const canTotp = () => props.totpEnabled || !props.hasPasskeys;
  const passkeyOnly = () => !props.totpEnabled && props.hasPasskeys;

  function clearErrors() {
    setEmailErr('');
    setPasswordErr('');
    setCodeErr('');
    setError('');
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    clearErrors();
    const addr = email().trim();
    if (!addr) {
      setEmailErr(t('auth.register.errors.emailRequired'));
      return;
    }
    if (!EMAIL_RE.test(addr)) {
      setEmailErr(t('auth.register.errors.emailInvalid'));
      return;
    }
    if (addr.toLowerCase() === props.currentEmail.trim().toLowerCase()) {
      setEmailErr(t('settings.security.email.change.errors.same'));
      return;
    }
    if (!password()) {
      setPasswordErr(t('auth.register.errors.passwordRequired'));
      return;
    }
    const c = code().trim();
    if (showCode() && !c) {
      setCodeErr(t('settings.security.email.change.errors.codeRequired'));
      return;
    }

    const input: EmailChangeInput = { email: addr, password: password() };
    if (showCode()) {
      if (useRecovery()) input.recovery_code = c;
      else input.code = c;
    }
    setBusy(true);
    try {
      const state = await submitEmailChange(input);
      setBusy(false);
      props.onDone(state, state.pending !== null);
    } catch (err) {
      if (isApiError(err) && err.code === 'mfa_required') setMfaRevealed(true);
      // A code is good for one try: a wrong or replayed one has to be typed again anyway.
      if (isApiError(err) && (err.code === 'invalid_code' || err.code === 'invalid_recovery_code')) setCode('');
      setError(translateCaughtApiError(err, t).join(' '));
      setBusy(false);
    }
  }

  return (
    <ResponsiveDialog
      size="sm"
      onClose={props.onClose}
      closeButton
      dismissible={!busy()}
      title={t('settings.security.email.change.title')}
      description={
        props.mailEnabled
          ? t('settings.security.email.change.descriptionMail')
          : t('settings.security.email.change.descriptionNoMail')
      }
      icon="fa-solid fa-envelope"
    >
      <form onSubmit={handleSubmit} class="space-y-3" novalidate>
        <Input
          type="email"
          autocomplete="email"
          label={t('settings.security.email.change.newLabel')}
          placeholder={t('settings.security.email.change.newPlaceholder')}
          value={email()}
          onInput={(e) => {
            clearErrors();
            setEmail(e.currentTarget.value);
          }}
          error={emailErr()}
          disabled={busy()}
          autofocus
        />
        <Input
          type="password"
          autocomplete="current-password"
          label={t('settings.security.email.change.passwordLabel')}
          value={password()}
          onInput={(e) => {
            clearErrors();
            setPassword(e.currentTarget.value);
          }}
          error={passwordErr()}
          disabled={busy()}
        />
        <Show when={showCode()}>
          <div class="space-y-1.5">
            <Input
              type="text"
              inputmode={useRecovery() ? 'text' : 'numeric'}
              autocomplete="one-time-code"
              label={useRecovery() ? t('auth.login.mfa.recoveryLabel') : t('auth.login.mfa.totpLabel')}
              placeholder={useRecovery() ? t('auth.login.mfa.recoveryPlaceholder') : t('auth.login.mfa.totpPlaceholder')}
              value={code()}
              onInput={(e) => {
                clearErrors();
                setCode(e.currentTarget.value);
              }}
              error={codeErr()}
              disabled={busy()}
            />
            <Show when={useRecovery()}>
              <p class="text-xs text-muted-foreground">
                {passkeyOnly()
                  ? t('settings.security.email.change.passkeyOnlyHint')
                  : t('settings.security.email.change.recoveryHint')}
              </p>
            </Show>
            <Show when={canTotp()}>
              <button
                type="button"
                class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                disabled={busy()}
                onClick={() => {
                  clearErrors();
                  setCode('');
                  setUseRecovery(!useRecovery());
                }}
              >
                {useRecovery() ? t('auth.login.mfa.useTotp') : t('auth.login.mfa.useRecovery')}
              </button>
            </Show>
          </div>
        </Show>
        <Show when={error()}>
          <p class="text-xs text-destructive">{error()}</p>
        </Show>
        <div class="flex flex-col gap-2 pt-1">
          <Button type="submit" class="w-full" loading={busy()}>
            {props.mailEnabled
              ? t('settings.security.email.change.submitMail')
              : t('settings.security.email.change.submitNoMail')}
          </Button>
          <Button type="button" variant="ghost" class="w-full" disabled={busy()} onClick={props.onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
};
