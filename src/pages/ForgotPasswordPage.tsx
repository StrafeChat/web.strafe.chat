import { createSignal, onMount, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { forgotPassword } from '../api/auth';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authFooterLinkClass,
  authPageOuter,
} from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { FormApiErrors } from '../components/auth/FormApiErrors';
import { instance, loadInstanceInfo } from '../stores/instance';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Forgot your password?": asks for the account's address and has the server mail a reset
 * link. The confirmation is worded "if an account exists" on purpose - the server answers
 * the same way for every well-formed address, and so must this page.
 */
export default function ForgotPasswordPage() {
  const [t] = useReactiveTranslate();
  const [email, setEmail] = createSignal('');
  const [emailErr, setEmailErr] = createSignal('');
  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [sentTo, setSentTo] = createSignal('');

  onMount(() => void loadInstanceInfo());
  // Only once the instance has answered: an instance that cannot send email has no reset
  // to offer, and saying so beats a form whose submit fails.
  const emailOff = () => instance.loaded && !instance.email.enabled;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setEmailErr('');
    setErrorLines([]);
    const value = email().trim();
    if (!value) {
      setEmailErr(t('auth.register.errors.emailRequired'));
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setEmailErr(t('auth.register.errors.emailInvalid'));
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(value);
      setSentTo(value);
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
            when={sentTo()}
            fallback={
              <>
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.forgot.title')}</CardTitle>
                  <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.forgot.subtitle')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent class={authCardContentClass}>
                    <Show when={emailOff()}>
                      <p role="status" class="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                        {t('auth.forgot.disabled')}
                      </p>
                    </Show>
                    <Input
                      type="email"
                      label={t('auth.forgot.emailLabel')}
                      placeholder={t('auth.forgot.emailPlaceholder')}
                      value={email()}
                      onInput={(e) => {
                        setErrorLines([]);
                        setEmailErr('');
                        setEmail(e.currentTarget.value);
                      }}
                      autocomplete="email"
                      disabled={loading() || emailOff()}
                      required
                      error={emailErr()}
                      autofocus
                    />
                    <FormApiErrors messages={errorLines()} id="forgot-password-api-errors" />
                  </CardContent>
                  <CardFooter class={authCardFooterClass}>
                    <Button type="submit" class="w-full font-semibold" loading={loading()} disabled={emailOff()}>
                      {t('auth.forgot.submit')}
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
              <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.forgot.sentTitle')}</CardTitle>
              <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.forgot.sentBody', { email: sentTo() })}</CardDescription>
            </CardHeader>
            <CardContent class={authCardContentClass}>
              <div class="flex justify-center">
                <span class="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <i class="fa-solid fa-envelope-open-text text-2xl" aria-hidden="true" />
                </span>
              </div>
            </CardContent>
            <CardFooter class={authCardFooterClass}>
              <A href="/login" class={authFooterLinkClass}>
                {t('auth.forgot.backToLogin')}
              </A>
            </CardFooter>
          </Show>
        </Card>
      </div>
    </div>
  );
}
