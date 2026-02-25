import { createSignal } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { register } from '../api/auth';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [dateOfBirth, setDateOfBirth] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError('');
    const eVal = email().trim();
    const uVal = username().trim();
    const pVal = password();
    const dob = dateOfBirth();
    if (!eVal || !uVal || !pVal || !dob) {
      setError('All fields are required');
      return;
    }
    if (pVal.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: eVal,
        username: uVal,
        password: pVal,
        date_of_birth: dob,
      });
      navigate('/login?registered=1', { replace: true });
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
            <CardTitle>Create an account</CardTitle>
            <CardDescription>Join StrafeChat</CardDescription>
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
                type="text"
                label="Username"
                placeholder="johndoe"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                autocomplete="username"
                disabled={loading()}
              />
              <Input
                type="password"
                label="Password"
                placeholder="At least 8 characters"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                autocomplete="new-password"
                disabled={loading()}
              />
              <Input
                type="date"
                label="Date of birth"
                value={dateOfBirth()}
                onInput={(e) => setDateOfBirth(e.currentTarget.value)}
                disabled={loading()}
              />
            </CardContent>
            <CardFooter class="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Button type="submit" class="w-full sm:w-auto" loading={loading()}>
                Create account
              </Button>
              <A
                href="/login"
                class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 text-center"
              >
                Already have an account? Sign in
              </A>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
