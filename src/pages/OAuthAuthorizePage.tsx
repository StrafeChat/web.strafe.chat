import type { Component } from 'solid-js';
import { createResource, createSignal, For, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { getAuthorizeInfo, authorize, type OAuthScope } from '../api/developers';
import { auth } from '../stores/auth';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { Button } from '../components/ui/Button';
import {
  authCardClass,
  authCardContentClass,
  authCardFooterClass,
  authCardHeaderClass,
  authCardShell,
  authPageOuter,
} from '../components/auth/authLayout';
import { AuthBrandMark } from '../components/auth/AuthBrandMark';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { t } from '../i18n';

const SCOPE_ICON: Record<OAuthScope, string> = { identify: 'fa-id-badge', email: 'fa-envelope', guilds: 'fa-layer-group' };

/**
 * OAuth2 consent screen (`/oauth2/authorize`). A third-party application sends the browser
 * here; the signed-in user sees who is asking and for what, and Authorize hands back a code
 * on the app's redirect. The server is the authority - this only renders what it validated
 * and posts the approval.
 */
const OAuthAuthorizePage: Component = () => {
  const [params] = useSearchParams<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
  }>();

  const query = () => ({
    response_type: params.response_type ?? 'code',
    client_id: params.client_id ?? '',
    redirect_uri: params.redirect_uri ?? '',
    scope: params.scope ?? '',
    state: params.state,
  });

  const [info] = createResource(
    () => (auth.token && query().client_id ? query() : null),
    (q) => getAuthorizeInfo(q),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const res = await authorize(query());
      window.location.href = res.location;
    } catch {
      setError(t('oauth.failed'));
      setBusy(false);
    }
  }

  function deny() {
    const uri = query().redirect_uri;
    if (uri) {
      const sep = uri.includes('?') ? '&' : '?';
      let back = `${uri}${sep}error=access_denied`;
      if (query().state) back += `&state=${encodeURIComponent(query().state!)}`;
      window.location.href = back;
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div class={authPageOuter}>
      <AuthBrandMark />
      <div class={authCardShell}>
        <Card class={authCardClass}>
          <Show
            when={auth.token}
            fallback={
              <>
                <CardHeader class={authCardHeaderClass}>
                  <CardTitle class="text-2xl font-bold text-foreground">{t('oauth.signInRequired')}</CardTitle>
                  <CardDescription class="mt-2">{t('oauth.signInBody')}</CardDescription>
                </CardHeader>
                <CardFooter class={authCardFooterClass}>
                  <Button
                    class="w-full font-semibold"
                    onClick={() => {
                      const back = encodeURIComponent(window.location.pathname + window.location.search);
                      window.location.href = `/login?return=${back}`;
                    }}
                  >
                    {t('oauth.signIn')}
                  </Button>
                </CardFooter>
              </>
            }
          >
            <Show
              when={info()}
              fallback={
                <CardContent class={`${authCardContentClass} min-h-40`}>
                  <Show
                    when={info.error}
                    fallback={<p class="text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
                  >
                    <div class="text-center">
                      <i class="fa-solid fa-triangle-exclamation mb-2 text-2xl text-destructive" aria-hidden="true" />
                      <p class="text-sm text-foreground">{t('oauth.invalidRequest')}</p>
                    </div>
                  </Show>
                </CardContent>
              }
            >
              {(d) => (
                <>
                  <CardHeader class={authCardHeaderClass}>
                    <div class="mb-3 flex justify-center">
                      <MessageAvatar name={d().application.name} avatar={d().application.icon} class="size-16 text-xl" />
                    </div>
                    <CardTitle class="text-center text-xl font-bold text-foreground">
                      {t('oauth.title', { app: d().application.name })}
                    </CardTitle>
                    <CardDescription class="mt-1 text-center">
                      {t('oauth.subtitle', { name: auth.user?.display_name || auth.user?.username || '' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent class={authCardContentClass}>
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('oauth.willBeAbleTo')}</p>
                    <ul class="space-y-2.5">
                      <For each={d().scopes}>
                        {(scope) => (
                          <li class="flex items-start gap-3">
                            <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                              <i class={`fa-solid ${SCOPE_ICON[scope] ?? 'fa-circle-check'} text-[11px]`} aria-hidden="true" />
                            </span>
                            <span class="text-sm text-foreground">{t(`oauth.scopes.${scope}`)}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                    <Show when={error()}>
                      <p class="text-sm text-destructive">{error()}</p>
                    </Show>
                  </CardContent>
                  <CardFooter class={`${authCardFooterClass} flex-row gap-2`}>
                    <Button variant="ghost" class="flex-1" onClick={deny} disabled={busy()}>
                      {t('oauth.cancel')}
                    </Button>
                    <Button class="flex-1 font-semibold" loading={busy()} onClick={() => void approve()}>
                      {t('oauth.authorize')}
                    </Button>
                  </CardFooter>
                </>
              )}
            </Show>
          </Show>
        </Card>
      </div>
    </div>
  );
};

export default OAuthAuthorizePage;
