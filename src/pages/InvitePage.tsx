import type { Component } from 'solid-js';
import { createSignal, createResource, Show } from 'solid-js';
import { useParams, useNavigate, A } from '@solidjs/router';
import { getInvitePreview, joinSpaceByInvite, parseInviteCode } from '../api/spaces';
import type { InvitePreview } from '../api/spaces';
import { auth } from '../stores/auth';
import { instance } from '../stores/instance';
import { spaces, addOrUpdateSpace } from '../stores/spaces';
import { instanceBaseUrl } from '../lib/utils/spaceInviteLink';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
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
import { t } from '../i18n';

/** Where the visitor last said their account lives, so the next invite is one click. */
const HOME_INSTANCE_KEY = 'strafe_home_instance';

function rememberedInstance(): string {
  try {
    return localStorage.getItem(HOME_INSTANCE_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Public invite landing page. Uses the auth-page layout so it sits above the fixed app
 * background (a non-positioned wrapper paints *under* that layer) and matches Login/Register.
 */
const InvitePage: Component = () => {
  const params = useParams<{ code: string }>();
  const navigate = useNavigate();
  // The segment arrives as typed in the URL: a federated code's "@" may be percent-encoded.
  const code = () => {
    const raw = params.code;
    try {
      return raw ? decodeURIComponent(raw) : raw;
    } catch {
      return raw;
    }
  };

  const [preview] = createResource(code, (c) => (c ? getInvitePreview(c) : null));
  const [joining, setJoining] = createSignal(false);
  const [error, setError] = createSignal('');
  const [homeInstance, setHomeInstance] = createSignal(rememberedInstance());
  const [instanceError, setInstanceError] = createSignal('');

  /**
   * The instance hosting the space, as a link from anywhere must name it: the origin for
   * a space mirrored here, this instance otherwise ('' when federation is off, and then
   * nobody from elsewhere can join anyway).
   */
  const originDomain = (d: InvitePreview) => d.space.federation?.origin_domain || instance.domain;

  /**
   * Someone whose account lives on another instance landed on this one's invite page:
   * send them to the same invite on their own instance, where they are logged in. The
   * code travels as code@origin so that instance knows where the space is hosted.
   */
  function continueOnInstance(d: InvitePreview) {
    const raw = homeInstance();
    const base = instanceBaseUrl(raw);
    const parsed = parseInviteCode(code() ?? '');
    const origin = originDomain(d);
    if (!base || !parsed || !origin) {
      setInstanceError(t('invite.invalidInstance'));
      return;
    }
    try {
      localStorage.setItem(HOME_INSTANCE_KEY, raw.trim());
    } catch {
      // ignore
    }
    if (base === window.location.origin) {
      navigate(`/login?redirect=${encodeURIComponent('/invite/' + code())}`);
      return;
    }
    window.location.assign(`${base}/invite/${encodeURIComponent(`${parsed.code}@${origin}`)}`);
  }

  async function handleJoin() {
    const c = code();
    if (!c) return;
    setError('');
    setJoining(true);
    try {
      const space = await joinSpaceByInvite(c);
      addOrUpdateSpace(space);
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invite.joinFailed'));
    } finally {
      setJoining(false);
    }
  }

  const invalid = () => preview.state === 'errored' || (preview.state === 'ready' && !preview());

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <Show when={preview.state === 'pending'}>
            <CardContent class="flex items-center justify-center gap-3 py-12">
              <span class="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span class="text-sm text-muted-foreground">{t('invite.loading')}</span>
            </CardContent>
          </Show>

          <Show when={invalid()}>
            <CardHeader class={authCardHeaderClass}>
              <div class="mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                <i class="fa-solid fa-link-slash text-2xl" aria-hidden="true" />
              </div>
              <CardTitle class="text-2xl font-bold tracking-tight text-foreground">{t('invite.invalidTitle')}</CardTitle>
              <CardDescription class="mt-2 text-base leading-relaxed">{t('invite.invalidBody')}</CardDescription>
            </CardHeader>
            <CardFooter class={authCardFooterClass}>
              <Button variant="outline" class="w-full" onClick={() => navigate('/')}>
                {t('invite.goHome')}
              </Button>
            </CardFooter>
          </Show>

          <Show when={preview.state === 'ready' && preview()}>
            {(data) => {
              const d = data();
              const isMember = () => spaces.spaces.some((s) => s.id === d.space.id);
              return (
                <>
                  <CardHeader class={authCardHeaderClass}>
                    <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('invite.youAreInvited')}
                    </p>
                    <div class="flex items-center gap-4">
                      <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-primary/20 text-2xl font-bold text-primary">
                        <Show
                          when={d.space.icon}
                          fallback={<span aria-hidden>{d.space.name_acronym || d.space.name?.slice(0, 2).toUpperCase() || '?'}</span>}
                        >
                          <img src={d.space.icon!} alt="" class="size-full object-cover" />
                        </Show>
                      </div>
                      <div class="min-w-0">
                        <CardTitle class="truncate text-2xl font-bold tracking-tight text-foreground">
                          {d.space.name}
                        </CardTitle>
                        <Show when={d.inviter?.display_name}>
                          <CardDescription class="mt-1">{t('invite.invitedBy', { name: d.inviter!.display_name })}</CardDescription>
                        </Show>
                        <Show when={d.space.federation?.origin_domain}>
                          {(domain) => (
                            <CardDescription class="mt-1" data-invite-hosted-on>
                              {t('space.hostedOn', { domain: domain() })}
                            </CardDescription>
                          )}
                        </Show>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent class={authCardContentClass}>
                    <Show when={d.space.description}>
                      <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{d.space.description}</p>
                    </Show>
                    <Show when={error()}>
                      <FormApiErrors messages={[error()]} />
                    </Show>
                  </CardContent>
                  <CardFooter class={authCardFooterClass}>
                    <Show
                      when={auth.token}
                      fallback={
                        <>
                          <p class="text-sm text-muted-foreground">{t('invite.logInToJoin')}</p>
                          <Button
                            class="w-full font-semibold"
                            onClick={() => navigate(`/login?redirect=${encodeURIComponent('/invite/' + code())}`)}
                          >
                            {t('invite.logIn')}
                          </Button>
                          <A
                            href="/register"
                            class="rounded-sm text-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {t('auth.login.registerLink')}
                          </A>
                          <Show when={originDomain(d)}>
                            <form
                              class="mt-2 w-full rounded-lg border border-border bg-muted/30 p-3 text-start"
                              data-invite-other-instance
                              onSubmit={(e) => {
                                e.preventDefault();
                                continueOnInstance(d);
                              }}
                            >
                              <p class="text-sm font-medium text-foreground">{t('invite.otherInstanceTitle')}</p>
                              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">{t('invite.otherInstanceBody')}</p>
                              <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                                <Input
                                  value={homeInstance()}
                                  placeholder={t('invite.instancePlaceholder')}
                                  autocomplete="url"
                                  spellcheck={false}
                                  aria-label={t('invite.otherInstanceTitle')}
                                  error={instanceError()}
                                  onInput={(e) => {
                                    setHomeInstance(e.currentTarget.value);
                                    setInstanceError('');
                                  }}
                                />
                                <Button variant="outline" class="shrink-0" onClick={() => continueOnInstance(d)}>
                                  {t('invite.continueOnInstance')}
                                </Button>
                              </div>
                            </form>
                          </Show>
                        </>
                      }
                    >
                      <Show
                        when={isMember()}
                        fallback={
                          <Button class="w-full font-semibold" onClick={handleJoin} loading={joining()}>
                            {t('invite.joinNamed', { name: d.space.name })}
                          </Button>
                        }
                      >
                        <p class="text-sm text-muted-foreground">{t('invite.alreadyMember')}</p>
                        <Button class="w-full font-semibold" onClick={() => navigate(`/spaces/${d.space.id}`)}>
                          {t('invite.openSpace')}
                        </Button>
                      </Show>
                    </Show>
                  </CardFooter>
                </>
              );
            }}
          </Show>
        </Card>
      </div>
    </div>
  );
};

export default InvitePage;
