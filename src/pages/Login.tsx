import { createSignal, Show } from 'solid-js';
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
import { setAuth, setAuthToken } from '../stores/auth';
import { getPasskeyAssertion, isWebauthnCancellation } from '../lib/webauthn';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authPageOuter,
} from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { FormApiErrors } from '../components/auth/FormApiErrors';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';

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

  // Second factor, once a password check comes back with mfa_required instead of a session.
  const [step, setStep] = createSignal<'password' | 'mfa'>('password');
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
      const res = await login({ email: eVal, password: pVal });
      if (isMFAChallenge(res)) {
        setMfaToken(res.mfa_token);
        setMfaMethods(res.methods);
        setActiveMethod(res.methods.includes('totp') ? 'totp' : 'webauthn');
        setUseRecovery(false);
        setMfaCode('');
        setStep('mfa');
        return;
      }
      completeLogin(res);
    } catch (err) {
      setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setLoading(false);
    }
  }

  function backToPassword() {
    setStep('password');
    setMfaToken('');
    setMfaCode('');
    setErrorLines([]);
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
      setErrorLines(translateCaughtApiError(err, t));
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
      if (!isWebauthnCancellation(err)) setErrorLines(translateCaughtApiError(err, t));
    } finally {
      setWebauthnBusy(false);
    }
  }

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
                    <Button type="submit" class="w-full font-semibold" loading={loading()}>
                      {t('auth.login.submit')}
                    </Button>
                    <A
                      href="/register"
                      class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                    >
                      {t('auth.login.registerLink')}
                    </A>
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
        </Card>
      </div>
    </div>
  );
}
