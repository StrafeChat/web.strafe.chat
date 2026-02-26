import { createSignal } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { login } from '../api/auth';
import { setAuth, setAuthToken } from '../stores/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    const eVal = email().trim();
    const pVal = password();
    if (!eVal || !pVal) {
      setError('Email and password are required');
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
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div class="w-full max-w-sm sm:max-w-md">
        <Card class="border-border">
          <CardHeader class="text-center sm:text-left">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to StrafeChat</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent class="space-y-4">
              {error() ? (
                <div
                  class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error()}
                </div>
              ) : null}
              <Input
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                autocomplete="email"
                disabled={loading()}
              />
              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                autocomplete="current-password"
                disabled={loading()}
              />
            </CardContent>
            <CardFooter class="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Button type="submit" class="w-full sm:w-auto" loading={loading()}>
                Sign in
              </Button>
              <A
                href="/register"
                class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 text-center"
              >
                Don't have an account? Register
              </A>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
