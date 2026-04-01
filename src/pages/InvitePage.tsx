import type { Component } from 'solid-js';
import { createSignal, createResource, Show } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { getInvitePreview, joinSpaceByInvite, type InvitePreview } from '../api/spaces';
import { auth } from '../stores/auth';
import { spaces } from '../stores/spaces';
import { Button } from '../components/ui/Button';

const InvitePage: Component = () => {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  const code = () => params.code;

  const [preview] = createResource(code, (c) => (c ? getInvitePreview(c) : null));
  const [joining, setJoining] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleJoin() {
    const c = code();
    if (!c) return;
    setError('');
    setJoining(true);
    try {
      const space = await joinSpaceByInvite(c);
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join space');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div class="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div class="w-full max-w-md border border-border rounded-lg overflow-hidden bg-card">
        <Show
          when={preview.state === 'ready' && preview()}
          fallback={
            <div class="p-6 flex flex-col gap-4">
              <Show when={preview.state === 'pending'}>
                <p class="text-sm text-muted-foreground">Loading invite…</p>
              </Show>
              <Show when={preview.state === 'errored' || (preview.state === 'ready' && !preview())}>
                <h1 class="text-lg font-semibold">Invalid or expired invite</h1>
                <p class="text-sm text-muted-foreground">
                  This invite link may be invalid or have expired. Ask for a new link.
                </p>
                <A href="/" class="text-primary text-sm underline">
                  Go home
                </A>
              </Show>
            </div>
          }
        >
          {(data) => {
            const d = data();
            return (
              <div class="flex flex-col">
                <div class="p-6 flex flex-col gap-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-14 rounded-xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0"
                      aria-hidden
                    >
                      {d.space.name_acronym || d.space.name?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div class="min-w-0">
                      <h1 class="text-lg font-semibold truncate">{d.space.name}</h1>
                      <Show when={d.inviter?.display_name}>
                        <p class="text-sm text-muted-foreground">
                          Invited by {d.inviter!.display_name}
                        </p>
                      </Show>
                    </div>
                  </div>
                  <Show when={d.space.description}>
                    <p class="text-sm text-muted-foreground line-clamp-3">
                      {d.space.description}
                    </p>
                  </Show>
                  <Show when={error()}>
                    <p class="text-sm text-destructive">{error()}</p>
                  </Show>
                </div>
                <div class="p-4 pt-4 flex flex-col gap-2 border-t border-border">
                  <Show
                    when={auth.token}
                    fallback={
                      <div class="flex flex-col gap-2">
                        <p class="text-sm text-muted-foreground">Log in to join this space.</p>
                        <A href={`/login?redirect=${encodeURIComponent('/invite/' + code())}`}>
                          <Button class="w-full">Log in</Button>
                        </A>
                        <A href="/register" class="text-center text-sm text-muted-foreground hover:text-foreground">
                          Create an account
                        </A>
                      </div>
                    }
                  >
                    {(() => {
                      const isMember = spaces.spaces.some((s) => s.id === d.space.id);
                      if (isMember) {
                        return (
                          <div class="flex flex-col gap-2">
                            <p class="text-sm text-muted-foreground">
                              You&apos;re already a member of this space.
                            </p>
                            <Button
                              class="w-full"
                              onClick={() => navigate(`/spaces/${d.space.id}`)}
                            >
                              Open space
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <Button
                          class="w-full"
                          onClick={handleJoin}
                          disabled={joining()}
                        >
                          {joining() ? 'Joining\u2026' : 'Join space'}
                        </Button>
                      );
                    })()}
                  </Show>
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </div>
  );
};

export default InvitePage;
