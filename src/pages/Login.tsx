import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams, A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  login,
  isMFAChallenge,
  verifyTotp,
  verifyRecoveryCode,
  beginWebauthnLogin,
  finishWebauthnLogin,
  type LoginResponse,
} from '../api/auth';
import { isApiError } from '../api/ApiError';
import { setAuth, setAuthToken } from '../stores/auth';
import { getPasskeyAssertion, isWebauthnCancellation } from '../lib/webauthn';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authFooterLinkClass,
  authPageOuter,
} from '../components/auth/authLayout';
import { instance, loadInstanceInfo } from '../stores/instance';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { FormApiErrors } from '../components/auth/FormApiErrors';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';
import { isDesktop } from '../desktop/env';
import { getDesktopInstance } from '../desktop/instanceOverride';
import { InstancePicker } from '../components/desktop/InstancePicker';
import { DesktopSavedAccounts } from '../components/desktop/SavedAccounts';

export default function Login() {
  const [t] = useReactiveTranslate();
  const navigate = useNavigate();
  // ?reason=banned|revoked: set by the gateway handler that signed us out. Read once;
  // it is a one-line explanation, not state.
  const [params] = useSearchParams<{ reason?: string }>();
  const arrivalNotice = () =>
    params.reason === 'banned'
      ? t('auth.login.bannedNotice')
      : params.reason === 'revoked'
        ? t('auth.login.revokedNotice')
        : '';
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);

  // The desktop app has to be told which instance first (InstancePicker); until one has
  // answered there is nowhere to send a password. A browser was served by its instance.
  const [instanceReady, setInstanceReady] = createSignal(!isDesktop() || !!getDesktopInstance());
  // Passkeys need the instance's domain as the page origin, which the desktop app's webview
  // is not: when the account has one, only the other factors are offered there.
  const [passkeyHidden, setPasskeyHidden] = createSignal(false);

  // Whether this instance can send email decides if "forgot your password?" exists.
  onMount(() => {
    if (instanceReady()) void loadInstanceInfo();
  });

  // Second factor, once a password check comes back with mfa_required instead of a session;
  // or 'unverified', when the password was right but the instance wants the address
  // confirmed first (the server re-sends the link on each such attempt, once a minute).
  const [step, setStep] = createSignal<'password' | 'mfa' | 'unverified'>('password');
  const [unverifiedSent, setUnverifiedSent] = createSignal(false);
  const [resending, setResending] = createSignal(false);
  const [mfaToken, setMfaToken] = createSignal('');
  const [mfaMethods, setMfaMethods] = createSignal<('totp' | 'webauthn')[]>([]);
  const [activeMethod, setActiveMethod] = createSignal<'totp' | 'webauthn'>('totp');
  // 'totp' also serves the recovery-code form - useRecovery just swaps which one is showing.
  const [useRecovery, setUseRecovery] = createSignal(false);
  const [mfaCode, setMfaCode] = createSignal('');
  const [webauthnBusy, setWebauthnBusy] = createSignal(false);

  function completeLogin(res: LoginResponse) {
    setAuthToken(res.token);
    setAuth({
      user: res.user,
      token: res.token,
      sessionId: null,
      loading: false,
      hydrated: true,
    });
    navigate('/', { replace: true });
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setErrorLines([]);
    const eVal = email().trim();
    const pVal = password();
    if (!eVal || !pVal) {
      setErrorLines([t('auth.login.clientErrorRequired')]);
      return;
    }
    setLoading(true);
    try {
      handleLoginResult(await login({ email: eVal, password: pVal }));
    } catch (err) {
      if (!handleUnverified(err)) setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setLoading(false);
    }
  }

  function handleLoginResult(res: Awaited<ReturnType<typeof login>>) {
    if (isMFAChallenge(res)) {
      const methods = isDesktop() ? res.methods.filter((m) => m !== 'webauthn') : res.methods;
      setPasskeyHidden(methods.length !== res.methods.length);
      setMfaToken(res.mfa_token);
      setMfaMethods(methods);
      setActiveMethod(methods.includes('totp') ? 'totp' : 'webauthn');
      // Nothing but a passkey on the account: the recovery code is the way in from here.
      setUseRecovery(methods.length === 0);
      setMfaCode('');
      setStep('mfa');
      return;
    }
    completeLogin(res);
  }

  /** The password was right but the address is not verified: show that state (with whether
   * a fresh link just went out) instead of an error. Returns false for any other failure. */
  function handleUnverified(err: unknown): boolean {
    if (!isApiError(err) || err.code !== 'email_unverified') return false;
    setUnverifiedSent(err.body?.verification_email_sent === true);
    setStep('unverified');
    return true;
  }

  /** "Send a new link" is simply another sign-in attempt: the server mails again (or says
   * one went out less than a minute ago), and if the address got verified in the meantime
   * this attempt signs the person in. */
  async function resendVerification() {
    setErrorLines([]);
    setResending(true);
    try {
      handleLoginResult(await login({ email: email().trim(), password: password() }));
    } catch (err) {
      if (!handleUnverified(err)) setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setResending(false);
    }
  }

  function backToPassword() {
    setStep('password');
    setMfaToken('');
    setMfaCode('');
    setErrorLines([]);
  }

  /**
   * A second-factor attempt failed. Two of the failures mean the pending login is dead -
   * the mfa_token expired (five minutes) or five wrong codes burned it - and retrying on
   * the same step can only fail the same way; the server's own message says "log in
   * again", so go back to the password step and keep that explanation on screen. Every
   * other failure (a wrong code, a cancelled passkey prompt) stays on the step so the
   * user can try again.
   */
  function failMfa(err: unknown) {
    const lines = translateCaughtApiError(err, t);
    if (isApiError(err) && (err.code === 'mfa_token_invalid' || err.code === 'mfa_too_many_attempts')) {
      backToPassword();
    }
    setErrorLines(lines);
  }

  async function handleMfaSubmit(e: Event) {
    e.preventDefault();
    setErrorLines([]);
    const code = mfaCode().trim();
    if (!code) {
      setErrorLines([t('auth.login.clientErrorRequired')]);
      return;
    }
    setLoading(true);
    try {
      const res = useRecovery()
        ? await verifyRecoveryCode({ mfa_token: mfaToken(), code })
        : await verifyTotp({ mfa_token: mfaToken(), code });
      completeLogin(res);
    } catch (err) {
      failMfa(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleWebauthnLogin() {
    setErrorLines([]);
    setWebauthnBusy(true);
    try {
      const { publicKey } = await beginWebauthnLogin(mfaToken());
      const credential = await getPasskeyAssertion(publicKey);
      const res = await finishWebauthnLogin(mfaToken(), credential);
      completeLogin(res);
    } catch (err) {
      if (!isWebauthnCancellation(err)) failMfa(err);
    } finally {
      setWebauthnBusy(false);
    }
  }

  const UnverifiedCard = () => (
    <>
      <CardHeader class={authCardHeaderClass}>
        <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.login.unverified.title')}</CardTitle>
        <CardDescription class="mt-2 text-base leading-relaxed">
          {unverifiedSent()
            ? t('auth.login.unverified.sent', { email: email().trim() })
            : t('auth.login.unverified.notSent', { email: email().trim() })}
        </CardDescription>
      </CardHeader>
      <CardContent class={authCardContentClass}>
        <div class="flex justify-center">
          <span class="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <i class="fa-solid fa-envelope-open-text text-2xl" aria-hidden="true" />
          </span>
        </div>
        <FormApiErrors messages={errorLines()} id="login-unverified-api-errors" />
      </CardContent>
      <CardFooter class={authCardFooterClass}>
        <Button type="button" class="w-full font-semibold" loading={resending()} onClick={() => void resendVerification()}>
          {t('auth.login.unverified.resend')}
        </Button>
        <Button type="button" variant="outline" class="w-full" disabled={resending()} onClick={backToPassword}>
          {t('auth.login.unverified.back')}
        </Button>
      </CardFooter>
    </>
  );

  const MfaSwitchLinks = () => (
    <div class="flex flex-col items-center gap-2 text-xs">
      <Show when={!useRecovery() && mfaMethods().length > 1}>
        <button
          type="button"
          class="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            setErrorLines([]);
            setActiveMethod(activeMethod() === 'totp' ? 'webauthn' : 'totp');
          }}
        >
          {activeMethod() === 'totp' ? t('auth.login.mfa.useWebauthn') : t('auth.login.mfa.useTotp')}
        </button>
      </Show>
      <Show when={mfaMethods().length > 0}>
        <button
          type="button"
          class="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            setErrorLines([]);
            setMfaCode('');
            setUseRecovery(!useRecovery());
          }}
        >
          {useRecovery() ? t('auth.login.mfa.backToTwoFactor') : t('auth.login.mfa.useRecovery')}
        </button>
      </Show>
      <button type="button" class="text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={backToPassword}>
        {t('auth.login.mfa.backToPassword')}
      </button>
    </div>
  );

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <AuthLanguageSwitcher />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <Show when={step() === 'unverified'} fallback={
          <Show
            when={step() === 'mfa'}
            fallback={
              <>
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.login.title')}</CardTitle>
                  <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.login.subtitle')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent class={authCardContentClass}>
                    <Show when={arrivalNotice()}>
                      <p role="status" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                        {arrivalNotice()}
                      </p>
                    </Show>
                    <Show when={isDesktop()}>
                      <InstancePicker disabled={loading()} onReady={setInstanceReady} />
                    </Show>
                    <Input
                      type="email"
                      label={t('auth.login.emailLabel')}
                      placeholder={t('auth.login.emailPlaceholder')}
                      value={email()}
                      onInput={(e) => {
                        setErrorLines([]);
                        setEmail(e.currentTarget.value);
                      }}
                      autocomplete="email"
                      disabled={loading()}
                    />
                    <Input
                      type="password"
                      label={t('auth.login.passwordLabel')}
                      placeholder={t('auth.login.passwordPlaceholder')}
                      value={password()}
                      onInput={(e) => {
                        setErrorLines([]);
                        setPassword(e.currentTarget.value);
                      }}
                      autocomplete="current-password"
                      disabled={loading()}
                    />
                    <FormApiErrors messages={errorLines()} id="login-api-errors" />
                  </CardContent>
                  <CardFooter class={authCardFooterClass}>
                    <Button type="submit" class="w-full font-semibold" loading={loading()} disabled={!instanceReady()}>
                      {t('auth.login.submit')}
                    </Button>
                    <A href="/register" class={authFooterLinkClass}>
                      {t('auth.login.registerLink')}
                    </A>
                    <Show when={instance.email.enabled}>
                      <A href="/forgot-password" class={authFooterLinkClass}>
                        {t('auth.login.forgotPassword')}
                      </A>
                    </Show>
                  </CardFooter>
                </form>
              </>
            }
          >
            <CardHeader class={authCardHeaderClass}>
              <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.login.mfa.title')}</CardTitle>
              <CardDescription class="mt-2 text-base leading-relaxed">
                {useRecovery() ? t('auth.login.mfa.recoverySubtitle') : t('auth.login.mfa.subtitle')}
              </CardDescription>
              <Show when={passkeyHidden()}>
                <p class="mt-2 text-xs text-muted-foreground">{t('desktop.passkeyUnavailable')}</p>
              </Show>
            </CardHeader>
            <Show
              when={!useRecovery() && activeMethod() === 'webauthn'}
              fallback={
                <form onSubmit={handleMfaSubmit}>
                  <CardContent class={authCardContentClass}>
                    <Input
                      type="text"
                      inputmode={useRecovery() ? 'text' : 'numeric'}
                      autocomplete="one-time-code"
                      label={useRecovery() ? t('auth.login.mfa.recoveryLabel') : t('auth.login.mfa.totpLabel')}
                      placeholder={useRecovery() ? t('auth.login.mfa.recoveryPlaceholder') : t('auth.login.mfa.totpPlaceholder')}
                      value={mfaCode()}
                      onInput={(e) => {
                        setErrorLines([]);
                        setMfaCode(e.currentTarget.value);
                      }}
                      disabled={loading()}
                      autofocus
                    />
                    <FormApiErrors messages={errorLines()} id="login-mfa-api-errors" />
                  </CardContent>
                  <CardFooter class={authCardFooterClass}>
                    <Button type="submit" class="w-full font-semibold" loading={loading()}>
                      {t('auth.login.mfa.submit')}
                    </Button>
                    <MfaSwitchLinks />
                  </CardFooter>
                </form>
              }
            >
              <CardContent class={authCardContentClass}>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full font-semibold"
                  loading={webauthnBusy()}
                  onClick={() => void handleWebauthnLogin()}
                >
                  <i class="fa-solid fa-passport mr-2" aria-hidden="true" />
                  {t('auth.login.mfa.webauthnPrompt')}
                </Button>
                <p class="text-center text-xs text-muted-foreground">{t('auth.login.mfa.webauthnHint')}</p>
                <FormApiErrors messages={errorLines()} id="login-mfa-api-errors" />
              </CardContent>
              <CardFooter class={authCardFooterClass}>
                <MfaSwitchLinks />
              </CardFooter>
            </Show>
          </Show>
          }>
            <UnverifiedCard />
          </Show>
        </Card>
        <Show when={isDesktop()}>
          <DesktopSavedAccounts />
        </Show>
      </div>
    </div>
  );
}
