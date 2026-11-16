import { createSignal, onMount, Show } from 'solid-js';
import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { auth, logout } from '../stores/auth';
import { confirmPendingEmailChange, currentAccountEmail, loadAccountEmail } from '../stores/accountEmail';
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
import { isApiError } from '../api/ApiError';
import { CONFIRM_EMAIL_PATH } from '../lib/emailChange';

/**
 * Where the link in the mail to a new address lands: /confirm-email?token=... The change is
 * confirmed from the session of the account that asked for it, so a signed-out visitor is
 * sent to sign in and brought back here (Login honours ?redirect=).
 *
 * Never redeemed on mount, only on the button: the token is single-use, and a mail scanner
 * that runs the page's script must not be able to spend it. Sessions are not signed out by
 * an email change, so success just continues into the app.
 */
export default function ConfirmEmailPage() {
  const [t] = useReactiveTranslate();
  const navigate = useNavigate();
  const [params] = useSearchParams<{ token?: string }>();
  const token = () => (typeof params.token === 'string' ? params.token : '').trim();

  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [doneEmail, setDoneEmail] = createSignal<string | null>(null);
  const [wrongAccount, setWrongAccount] = createSignal(false);

  const signedIn = () => !!auth.token;
  const loginHref = () =>
    `/login?redirect=${encodeURIComponent(`${CONFIRM_EMAIL_PATH}?token=${encodeURIComponent(token())}`)}`;

  onMount(() => {
    // A read only: shows which address this would switch to.
    if (token() && signedIn()) void loadAccountEmail();
  });

  async function handleConfirm() {
    setErrorLines([]);
    setWrongAccount(false);
    setLoading(true);
    try {
      const state = await confirmPendingEmailChange(token());
      setDoneEmail(state.email);
    } catch (err) {
      if (isApiError(err) && err.code === 'email_change_wrong_account') setWrongAccount(true);
      setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setLoading(false);
    }
  }

  function signInAsOther() {
    logout();
    navigate(loginHref());
  }

  const pendingEmail = () => currentAccountEmail()?.pending?.email ?? '';

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <AuthLanguageSwitcher />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <Show
            when={token()}
            fallback={
              <>
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.confirmEmail.title')}</CardTitle>
                </CardHeader>
                <CardContent class={authCardContentClass}>
                  <FormApiErrors messages={[t('auth.confirmEmail.missingToken')]} id="confirm-email-errors" />
                </CardContent>
                <CardFooter class={authCardFooterClass}>
                  <A href="/" class={authPrimaryLinkClass}>
                    {t('auth.confirmEmail.continueApp')}
                  </A>
                </CardFooter>
              </>
            }
          >
            <Show
              when={signedIn()}
              fallback={
                <>
                  <CardHeader class={authCardHeaderClass}>
                    <CardTitle class="text-3xl font-bold tracking-tight text-foreground">
                      {t('auth.confirmEmail.signInTitle')}
                    </CardTitle>
                    <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.confirmEmail.signInBody')}</CardDescription>
                  </CardHeader>
                  <CardFooter class={authCardFooterClass}>
                    <Button type="button" class="w-full font-semibold" onClick={() => navigate(loginHref())}>
                      {t('auth.confirmEmail.signIn')}
                    </Button>
                  </CardFooter>
                </>
              }
            >
              <Show
                when={doneEmail() === null}
                fallback={
                  <>
                    <CardHeader class={authCardHeaderClass}>
                      <CardTitle class="text-3xl font-bold tracking-tight text-foreground">
                        {t('auth.confirmEmail.successTitle')}
                      </CardTitle>
                      <CardDescription class="mt-2 break-words text-base leading-relaxed">
                        {t('auth.confirmEmail.successBody', { email: doneEmail() ?? '' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent class={authCardContentClass}>
                      <div class="flex justify-center">
                        <span class="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <i class="fa-solid fa-circle-check text-2xl" aria-hidden="true" />
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter class={authCardFooterClass}>
                      <A href="/" class={authPrimaryLinkClass}>
                        {t('auth.confirmEmail.continueApp')}
                      </A>
                    </CardFooter>
                  </>
                }
              >
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.confirmEmail.title')}</CardTitle>
                  <CardDescription class="mt-2 break-words text-base leading-relaxed">
                    {pendingEmail()
                      ? t('auth.confirmEmail.subtitle', { email: pendingEmail() })
                      : t('auth.confirmEmail.subtitleGeneric')}
                  </CardDescription>
                </CardHeader>
                <CardContent class={authCardContentClass}>
                  <FormApiErrors messages={errorLines()} id="confirm-email-errors" />
                </CardContent>
                <CardFooter class={authCardFooterClass}>
                  <Button type="button" class="w-full font-semibold" loading={loading()} onClick={() => void handleConfirm()}>
                    {t('auth.confirmEmail.submit')}
                  </Button>
                  <Show when={wrongAccount()}>
                    <Button type="button" variant="outline" class="w-full" onClick={signInAsOther}>
                      {t('auth.confirmEmail.signIn')}
                    </Button>
                  </Show>
                </CardFooter>
              </Show>
            </Show>
          </Show>
        </Card>
      </div>
    </div>
  );
}
