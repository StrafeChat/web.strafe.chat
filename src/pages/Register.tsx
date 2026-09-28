import { createSignal, onMount, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { DatePickerField } from '../components/ui/DatePickerField';
import { register } from '../api/auth';
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
import { CaptchaWidget } from '../components/auth/CaptchaWidget';
import { instance, loadInstanceInfo } from '../stores/instance';
import { AuthLanguageSwitcher, useReactiveTranslate } from '../i18n';
import { translateCaughtApiError } from '../lib/formatApiError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseISODate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Minimum age 13 (simple calendar-year check is ok for UX; backend may enforce stricter) */
function isAtLeastAge(dob: Date, years: number) {
  const t = new Date();
  const cutoff = new Date(t.getFullYear() - years, t.getMonth(), t.getDate());
  return dob <= cutoff;
}

export default function Register() {
  const [t] = useReactiveTranslate();
  const navigate = useNavigate();
  const [step, setStep] = createSignal<1 | 2>(1);

  const [email, setEmail] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [dateOfBirth, setDateOfBirth] = createSignal('');

  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [emailErr, setEmailErr] = createSignal('');
  const [dobErr, setDobErr] = createSignal('');
  const [usernameErr, setUsernameErr] = createSignal('');
  const [passwordErr, setPasswordErr] = createSignal('');

  const [loading, setLoading] = createSignal(false);

  // Registration challenge, when this instance runs one.
  const [captchaToken, setCaptchaToken] = createSignal('');
  const [captchaBroken, setCaptchaBroken] = createSignal(false);
  let resetCaptcha: (() => void) | null = null;
  const captchaRequired = () => instance.captcha.enabled;
  onMount(() => void loadInstanceInfo());

  function clearStep1Errors() {
    setEmailErr('');
    setDobErr('');
    setErrorLines([]);
  }

  function clearStep2Errors() {
    setUsernameErr('');
    setPasswordErr('');
    setErrorLines([]);
  }

  function goStep1() {
    setStep(1);
    clearStep2Errors();
    setErrorLines([]);
  }

  function handleStep1Next(e: Event) {
    e.preventDefault();
    clearStep1Errors();
    const eVal = email().trim();
    const dobIso = dateOfBirth();

    let ok = true;
    if (!eVal) {
      setEmailErr(t('auth.register.errors.emailRequired'));
      ok = false;
    } else if (!EMAIL_RE.test(eVal)) {
      setEmailErr(t('auth.register.errors.emailInvalid'));
      ok = false;
    }

    if (!dobIso) {
      setDobErr(t('auth.register.errors.dobRequired'));
      ok = false;
    } else {
      const dob = parseISODate(dobIso);
      if (!dob) {
        setDobErr(t('auth.register.errors.dobInvalid'));
        ok = false;
      } else if (!isAtLeastAge(dob, 13)) {
        setDobErr(t('auth.register.errors.dobAge'));
        ok = false;
      }
    }

    if (!ok) return;
    setStep(2);
  }

  async function handleFinalSubmit(e: Event) {
    e.preventDefault();
    clearStep2Errors();
    setErrorLines([]);

    const uVal = username().trim();
    const pVal = password();
    const eVal = email().trim();
    const dobIso = dateOfBirth();

    let ok = true;
    if (!uVal) {
      setUsernameErr(t('auth.register.errors.usernameRequired'));
      ok = false;
    }
    if (!pVal) {
      setPasswordErr(t('auth.register.errors.passwordRequired'));
      ok = false;
    } else if (pVal.length < 8) {
      setPasswordErr(t('auth.register.errors.passwordMin'));
      ok = false;
    }

    if (captchaRequired() && !captchaToken()) {
      setErrorLines([captchaBroken() ? t('auth.register.captchaUnavailable') : t('auth.register.captchaRequired')]);
      ok = false;
    }

    if (!ok) return;

    setLoading(true);
    try {
      const dateOfBirthRFC3339 = `${dobIso}T00:00:00.000Z`;
      await register({
        email: eVal,
        username: uVal,
        password: pVal,
        date_of_birth: dateOfBirthRFC3339,
        ...(captchaToken() ? { captcha_token: captchaToken() } : {}),
      });
      navigate('/login?registered=1', { replace: true });
    } catch (err) {
      setErrorLines(translateCaughtApiError(err, t));
      // A token is single-use: whatever went wrong, the old one can't be replayed, so
      // re-arm the widget instead of leaving a dead token in the form.
      resetCaptcha?.();
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
          <CardHeader class={authCardHeaderClass}>
            <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.register.title')}</CardTitle>
            <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.register.subtitle')}</CardDescription>
          </CardHeader>

          <Show when={step() === 1}>
            <form onSubmit={handleStep1Next}>
              <CardContent class={authCardContentClass}>
                <Input
                  type="email"
                  label={t('auth.register.emailLabel')}
                  placeholder={t('auth.register.emailPlaceholder')}
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  autocomplete="email"
                  disabled={loading()}
                  required
                  error={emailErr()}
                />
                <DatePickerField
                  label={t('auth.register.dobLabel')}
                  value={dateOfBirth()}
                  onChange={setDateOfBirth}
                  disabled={loading()}
                  required
                  error={dobErr()}
                />
              </CardContent>
              <CardFooter class={authCardFooterClass}>
                <Button type="submit" class="w-full font-semibold" loading={loading()}>
                  {t('auth.register.next')}
                </Button>
                <A
                  href="/login"
                  class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                >
                  {t('auth.register.signInLink')}
                </A>
              </CardFooter>
            </form>
          </Show>

          <Show when={step() === 2}>
            <form onSubmit={handleFinalSubmit}>
              <CardContent class={authCardContentClass}>
                <Input
                  type="text"
                  label={t('auth.register.usernameLabel')}
                  placeholder={t('auth.register.usernamePlaceholder')}
                  value={username()}
                  onInput={(e) => {
                    setErrorLines([]);
                    setUsername(e.currentTarget.value);
                  }}
                  autocomplete="username"
                  disabled={loading()}
                  required
                  error={usernameErr()}
                />
                <Input
                  type="password"
                  label={t('auth.register.passwordLabel')}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  value={password()}
                  onInput={(e) => {
                    setErrorLines([]);
                    setPassword(e.currentTarget.value);
                  }}
                  autocomplete="new-password"
                  disabled={loading()}
                  required
                  error={passwordErr()}
                />
                <Show when={captchaRequired()}>
                  <CaptchaWidget
                    provider={instance.captcha.provider}
                    siteKey={instance.captcha.siteKey}
                    apiUrl={instance.captcha.apiUrl}
                    onToken={(token) => {
                      setCaptchaToken(token);
                      if (token) setErrorLines([]);
                    }}
                    onReady={(reset) => (resetCaptcha = reset)}
                    onLoadError={() => {
                      setCaptchaBroken(true);
                      setErrorLines([t('auth.register.captchaUnavailable')]);
                    }}
                  />
                </Show>
                <FormApiErrors messages={errorLines()} id="register-api-errors" />
              </CardContent>
              <CardFooter class={authCardFooterClass}>
                <Button
                  type="submit"
                  class="w-full font-semibold"
                  loading={loading()}
                  disabled={captchaRequired() && !captchaToken()}
                >
                  {t('auth.register.createAccount')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full"
                  disabled={loading()}
                  onClick={goStep1}
                >
                  {t('auth.register.back')}
                </Button>
                <A
                  href="/login"
                  class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 text-start rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                >
                  {t('auth.register.signInLink')}
                </A>
              </CardFooter>
            </form>
          </Show>
        </Card>
      </div>
    </div>
  );
}
