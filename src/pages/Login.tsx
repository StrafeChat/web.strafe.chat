import { createSignal } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { login } from '../api/auth';
import { setAuth, setAuthToken } from '../stores/auth';
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
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [errorLines, setErrorLines] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(false);

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
      setAuthToken(res.token);
      setAuth({
        user: res.user,
        token: res.token,
        sessionId: null,
        loading: false,
        hydrated: true,
      });
      navigate('/', { replace: true });
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
          <CardHeader class={authCardHeaderClass}>
            <CardTitle class="text-3xl font-bold tracking-tight text-foreground">{t('auth.login.title')}</CardTitle>
            <CardDescription class="mt-2 text-base leading-relaxed">{t('auth.login.subtitle')}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent class={authCardContentClass}>
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
                class="rounded-xl"
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
                class="rounded-xl"
              />
              <FormApiErrors messages={errorLines()} id="login-api-errors" />
            </CardContent>
            <CardFooter class={authCardFooterClass}>
              <Button type="submit" class="w-full rounded-full font-semibold" loading={loading()}>
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
        </Card>
      </div>
    </div>
  );
}
