import { createSignal, onMount, Show } from 'solid-js';
import { A, useSearchParams } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { verifyEmail } from '../api/auth';
import { auth } from '../stores/auth';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authPageOuter,
  authPrimaryLinkClass,
} from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { FormApiErrors } from '../components/auth/FormApiErrors';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';

/**
 * Where a verification email's link lands: /verify-email?token=... The token is redeemed on
 * arrival - there is nothing for the person to type - and the page says whether it took.
 * Works signed out (the usual case: the link was opened in a fresh tab or another browser)
 * and signed in alike; the token is single-use, so a second visit reports it invalid.
 */
export default function VerifyEmailPage() {
  const [t] = useReactiveTranslate();
  const [params] = useSearchParams<{ token?: string }>();
  const [state, setState] = createSignal<'working' | 'ok' | 'failed'>('working');
  const [errorLines, setErrorLines] = createSignal<string[]>([]);

  onMount(async () => {
    const token = (params.token ?? '').trim();
    if (!token) {
      setErrorLines([t('auth.verifyEmail.missingToken')]);
      setState('failed');
      return;
    }
    try {
      await verifyEmail(token);
      setState('ok');
    } catch (err) {
      setErrorLines(translateCaughtApiError(err, t));
      setState('failed');
    }
  });

  const signedIn = () => !!auth.token;
  const title = () =>
    state() === 'working'
      ? t('auth.verifyEmail.title')
      : state() === 'ok'
        ? t('auth.verifyEmail.successTitle')
        : t('auth.verifyEmail.failTitle');

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <AuthLanguageSwitcher />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <CardHeader class={authCardHeaderClass}>
            <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{title()}</CardTitle>
            <Show when={state() === 'ok'}>
              <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.verifyEmail.successBody')}</CardDescription>
            </Show>
          </CardHeader>
          <CardContent class={authCardContentClass}>
            <Show when={state() === 'working'}>
              <div class="flex justify-center py-2" role="status" aria-live="polite">
                <span class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            </Show>
            <Show when={state() === 'ok'}>
              <div class="flex justify-center">
                <span class="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <i class="fa-solid fa-circle-check text-2xl" aria-hidden="true" />
                </span>
              </div>
            </Show>
            <FormApiErrors messages={errorLines()} id="verify-email-errors" />
          </CardContent>
          <Show when={state() !== 'working'}>
            <CardFooter class={authCardFooterClass}>
              <A href={signedIn() ? '/' : '/login'} class={authPrimaryLinkClass}>
                {signedIn() ? t('auth.verifyEmail.continueApp') : t('auth.verifyEmail.goToLogin')}
              </A>
            </CardFooter>
          </Show>
        </Card>
      </div>
    </div>
  );
}
