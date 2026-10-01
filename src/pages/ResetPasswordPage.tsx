import { createSignal, onMount, Show } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { resetPassword } from '../api/auth';
import { auth, logout } from '../stores/auth';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authFooterLinkClass,
  authPageOuter,
  authPrimaryLinkClass,
} from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { FormApiErrors } from '../components/auth/FormApiErrors';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';

/**
 * Where a password-reset email's link lands: /reset-password?token=... Asks for the new
 * password twice and redeems the token with it. The server ends every session of the
 * account on success, so if this browser happened to be signed in, it is signed out here
 * too rather than left holding a token the next request would 401.
 */
export default function ResetPasswordPage() {
  const [t] = useReactiveTranslate();
  const [params] = useSearchParams<{ token?: string }>();
  const token = () => (params.token ?? '').trim();

  const [password, setPassword] = createSignal('');
  const [confirm, setConfirm] = createSignal('');
  const [passwordErr, setPasswordErr] = createSignal('');
  const [confirmErr, setConfirmErr] = createSignal('');
  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [done, setDone] = createSignal(false);

  onMount(() => {
    if (!token()) setErrorLines([t('auth.reset.missingToken')]);
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setPasswordErr('');
    setConfirmErr('');
    setErrorLines([]);
    if (!token()) {
      setErrorLines([t('auth.reset.missingToken')]);
      return;
    }
    let ok = true;
    if (!password()) {
      setPasswordErr(t('auth.register.errors.passwordRequired'));
      ok = false;
    } else if (password().length < 8) {
      setPasswordErr(t('auth.register.errors.passwordMin'));
      ok = false;
    }
    if (ok && confirm() !== password()) {
      setConfirmErr(t('auth.reset.mismatch'));
      ok = false;
    }
    if (!ok) return;
    setLoading(true);
    try {
      await resetPassword(token(), password());
      if (auth.token) logout();
      setDone(true);
    } catch (err) {
      setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <AuthLanguageSwitcher />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <Show
            when={done()}
            fallback={
              <>
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.reset.title')}</CardTitle>
                  <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.reset.subtitle')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent class={authCardContentClass}>
                    <Input
                      type="password"
                      label={t('auth.reset.passwordLabel')}
                      placeholder={t('auth.reset.passwordPlaceholder')}
                      value={password()}
                      onInput={(e) => {
                        setErrorLines([]);
                        setPasswordErr('');
                        setPassword(e.currentTarget.value);
                      }}
                      autocomplete="new-password"
                      disabled={loading() || !token()}
                      required
                      error={passwordErr()}
                      autofocus
                    />
                    <Input
                      type="password"
                      label={t('auth.reset.confirmLabel')}
                      placeholder={t('auth.reset.confirmPlaceholder')}
                      value={confirm()}
                      onInput={(e) => {
                        setConfirmErr('');
                        setConfirm(e.currentTarget.value);
                      }}
                      autocomplete="new-password"
                      disabled={loading() || !token()}
                      required
                      error={confirmErr()}
                    />
                    <FormApiErrors messages={errorLines()} id="reset-password-api-errors" />
                  </CardContent>
                  <CardFooter class={authCardFooterClass}>
                    <Button type="submit" class="w-full font-semibold" loading={loading()} disabled={!token()}>
                      {t('auth.reset.submit')}
                    </Button>
                    <A href="/login" class={authFooterLinkClass}>
                      {t('auth.forgot.backToLogin')}
                    </A>
                  </CardFooter>
                </form>
              </>
            }
          >
            <CardHeader class={authCardHeaderClass}>
              <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.reset.successTitle')}</CardTitle>
              <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.reset.successBody')}</CardDescription>
            </CardHeader>
            <CardContent class={authCardContentClass}>
              <div class="flex justify-center">
                <span class="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <i class="fa-solid fa-circle-check text-2xl" aria-hidden="true" />
                </span>
              </div>
            </CardContent>
            <CardFooter class={authCardFooterClass}>
              <A href="/login" class={authPrimaryLinkClass}>
                {t('auth.reset.goToLogin')}
              </A>
            </CardFooter>
          </Show>
        </Card>
      </div>
    </div>
  );
}
