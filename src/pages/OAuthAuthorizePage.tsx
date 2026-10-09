import type { Component } from 'solid-js';
import { createEffect, createMemo, createResource, createSignal, ErrorBoundary, For, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { getAuthorizeInfo, authorize, scopeKey, type AuthorizeInfo, type OAuthScope } from '../api/developers';
import { isApiError } from '../api/ApiError';
import { auth } from '../stores/auth';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Checkbox } from '../components/ui/Checkbox';
import { PermAdministrator, SPACE_ROLE_PERM_ROWS } from '../lib/spacePermissions';
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
import { isDesktop } from '../desktop/env';
import { closeCurrentWindow, desktopWindow } from '../desktop/native';

/**
 * Back to the app when the consent flow has nowhere else to go. In the desktop app this
 * page opens in a window of its own (lib/openWindow.ts), so "done" means closing it.
 */
function goHome(): void {
  if (isDesktop() && desktopWindow.isPopup()) {
    void closeCurrentWindow();
    return;
  }
  window.location.href = '/';
}

const SCOPE_ICON: Record<OAuthScope, string> = {
  identify: 'fa-id-badge',
  email: 'fa-envelope',
  spaces: 'fa-layer-group',
  'spaces.join': 'fa-user-plus',
  bot: 'fa-robot',
};

/**
 * OAuth2 consent screen (`/oauth2/authorize`). A third-party application sends the browser
 * here; the signed-in user sees who is asking and for what, and Authorize hands back a code
 * on the app's redirect. With the `bot` scope it is also the bot installer: pick one of the
 * spaces you manage, review the permissions the bot asked for (unchecking any you would
 * rather not grant), and the bot joins that space with a role carrying the rest. The server
 * is the authority - this only renders what it validated and posts the approval.
 */
const OAuthAuthorizePage: Component = () => {
  const [params] = useSearchParams<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    permissions?: string;
    space_id?: string;
    disable_space_select?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>();

  const query = () => ({
    response_type: params.response_type ?? 'code',
    client_id: params.client_id ?? '',
    redirect_uri: params.redirect_uri ?? '',
    scope: params.scope ?? '',
    state: params.state,
    permissions: params.permissions,
    code_challenge: params.code_challenge,
    code_challenge_method: params.code_challenge_method,
  });

  const [info] = createResource(
    () => (auth.token && query().client_id ? query() : null),
    (q) => getAuthorizeInfo(q),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  // The bot install, once it happened without a redirect to go to.
  const [installed, setInstalled] = createSignal<{ spaceId: string; spaceName: string } | null>(null);

  // ---- bot install state ----
  const wantsBot = () => !!info()?.bot;
  const targets = () => info()?.spaces ?? [];
  const [spaceId, setSpaceId] = createSignal('');
  const [granted, setGranted] = createSignal<number>(0);
  const spaceLocked = () => params.disable_space_select === 'true' && targets().some((s) => s.id === params.space_id);
  const selectedTarget = () => targets().find((s) => s.id === spaceId());
  const grantable = () => selectedTarget()?.grantable_permissions ?? 0;
  /** The permission rows the application asked for, in the role editor's order. */
  const requestedRows = createMemo(() => {
    const bits = info()?.permissions ?? 0;
    return SPACE_ROLE_PERM_ROWS.filter((r) => (bits & r.bit) !== 0);
  });
  const canGrant = (bit: number) => (grantable() & (bit | PermAdministrator)) !== 0;

  // Seed the picker (the link may name a space) and the checked permissions once the
  // request is known, and re-seed the permissions when the space changes: what can be
  // granted differs per space.
  createEffect(() => {
    const d = info();
    if (!d?.bot) return;
    const list = d.spaces ?? [];
    const preferred = list.find((s) => s.id === params.space_id)?.id ?? list[0]?.id ?? '';
    setSpaceId(preferred);
  });
  createEffect(() => {
    const d = info();
    if (!d?.bot) return;
    const g = grantable();
    setGranted((d.permissions ?? 0) & (g & PermAdministrator ? ~0 : g));
  });

  function togglePermission(bit: number, on: boolean) {
    setGranted((cur) => (on ? cur | bit : cur & ~bit));
  }

  function describeError(e: unknown): string {
    if (isApiError(e)) {
      if (e.message === 'access_denied' && e.description?.includes('private')) return t('oauth.botPrivate');
      if (e.description) return e.description;
      if (e.message === 'invalid_scope' || e.message === 'invalid_client') return t('oauth.invalidRequest');
    }
    return t('oauth.failed');
  }

  async function approve() {
    setBusy(true);
    setError('');
    try {
      const req = { ...query() } as Parameters<typeof authorize>[0];
      if (wantsBot()) {
        if (!spaceId()) {
          setError(t('oauth.noSpaceSelected'));
          setBusy(false);
          return;
        }
        req.space_id = spaceId();
        req.permissions = String(granted());
      }
      const res = await authorize(req);
      if (res.location) {
        window.location.href = res.location;
        return;
      }
      // A bare bot install: nowhere to redirect, so say what happened here.
      const target = selectedTarget();
      setInstalled({ spaceId: res.space_id ?? spaceId(), spaceName: target?.name ?? '' });
      setBusy(false);
    } catch (e) {
      setError(describeError(e));
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
      goHome();
    }
  }

  const appName = (d: AuthorizeInfo) => d.application.name;
  const botName = (d: AuthorizeInfo) => d.bot?.display_name || d.bot?.username || appName(d);

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
            <ErrorBoundary
              fallback={(e) => (
                <CardContent class={`${authCardContentClass} min-h-40`}>
                  <div class="text-center">
                    <i class="fa-solid fa-triangle-exclamation mb-2 text-2xl text-destructive" aria-hidden="true" />
                    <p class="text-sm text-foreground">{describeError(e)}</p>
                  </div>
                </CardContent>
              )}
            >
              <Show
                when={info()}
                fallback={
                  <CardContent class={`${authCardContentClass} min-h-40`}>
                    <p class="text-center text-sm text-muted-foreground">{t('common.loading')}</p>
                  </CardContent>
                }
              >
                {(d) => (
                  <Show
                    when={!installed()}
                    fallback={
                      <>
                        <CardHeader class={authCardHeaderClass}>
                          <div class="mb-3 flex justify-center">
                            <span class="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                              <i class="fa-solid fa-check text-2xl" aria-hidden="true" />
                            </span>
                          </div>
                          <CardTitle class="text-center text-xl font-bold text-foreground">
                            {t('oauth.addedTitle', { bot: botName(d()) })}
                          </CardTitle>
                          <CardDescription class="mt-1 text-center">
                            {t('oauth.addedBody', { bot: botName(d()), space: installed()!.spaceName })}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter class={`${authCardFooterClass} flex-row gap-2`}>
                          <Button
                            variant="ghost"
                            class="flex-1"
                            onClick={() => {
                              goHome();
                            }}
                          >
                            {t('oauth.done')}
                          </Button>
                          <Button
                            class="flex-1 font-semibold"
                            onClick={() => {
                              window.location.href = `/spaces/${installed()!.spaceId}`;
                            }}
                          >
                            {t('oauth.openSpace')}
                          </Button>
                        </CardFooter>
                      </>
                    }
                  >
                    <CardHeader class={authCardHeaderClass}>
                      <div class="mb-3 flex justify-center">
                        <MessageAvatar
                          name={wantsBot() ? botName(d()) : appName(d())}
                          avatar={wantsBot() ? d().bot?.avatar || d().application.icon : d().application.icon}
                          class="size-16 text-xl"
                        />
                      </div>
                      <CardTitle class="text-center text-xl font-bold text-foreground">
                        {wantsBot() ? t('oauth.botTitle', { bot: botName(d()) }) : t('oauth.title', { app: appName(d()) })}
                      </CardTitle>
                      <CardDescription class="mt-1 text-center">
                        {t('oauth.subtitle', { name: auth.user?.display_name || auth.user?.username || '' })}
                      </CardDescription>
                      <Show when={d().application.description}>
                        <p class="mt-2 text-center text-xs text-muted-foreground">{d().application.description}</p>
                      </Show>
                    </CardHeader>
                    <CardContent class={`${authCardContentClass} space-y-4`}>
                      {/* Bot install: where, then with what. */}
                      <Show when={wantsBot()}>
                        <div class="space-y-3">
                          <Show
                            when={targets().length > 0}
                            fallback={<p class="text-sm text-destructive">{t('oauth.noSpaces')}</p>}
                          >
                            <Show
                              when={!spaceLocked()}
                              fallback={
                                <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                  <MessageAvatar name={selectedTarget()?.name ?? ''} avatar={selectedTarget()?.icon} class="size-8 text-xs" />
                                  <div class="min-w-0">
                                    <div class="text-xs text-muted-foreground">{t('oauth.addToSpace')}</div>
                                    <div class="truncate text-sm font-medium text-foreground">{selectedTarget()?.name}</div>
                                    <Show when={selectedTarget()?.hosted_on}>
                                      {(domain) => <div class="truncate text-xs text-muted-foreground">{t('space.hostedOn', { domain: domain() })}</div>}
                                    </Show>
                                  </div>
                                </div>
                              }
                            >
                              <Select label={t('oauth.addToSpace')} value={spaceId()} onValueChange={setSpaceId}>
                                <For each={targets()}>
                                  {(s) => (
                                    <option value={s.id}>
                                      {s.hosted_on ? `${s.name} · ${t('space.hostedOn', { domain: s.hosted_on })}` : s.name}
                                    </option>
                                  )}
                                </For>
                              </Select>
                            </Show>
                            <p class="text-xs text-muted-foreground">{t('oauth.requiresManage')}</p>
                          </Show>

                          <Show
                            when={requestedRows().length > 0}
                            fallback={<p class="text-sm text-muted-foreground">{t('oauth.noPermissions')}</p>}
                          >
                            <div>
                              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('oauth.permissionsTitle', { bot: botName(d()) })}
                              </p>
                              <p class="mt-1 text-xs text-muted-foreground">{t('oauth.permissionsHint')}</p>
                              <ul class="mt-2 max-h-56 space-y-2 overflow-y-auto pe-1">
                                <For each={requestedRows()}>
                                  {(r) => (
                                    <li>
                                      <Checkbox
                                        checked={(granted() & r.bit) !== 0}
                                        disabled={!canGrant(r.bit) || targets().length === 0}
                                        onChange={(on) => togglePermission(r.bit, on)}
                                        label={r.label}
                                        description={canGrant(r.bit) ? r.description : t('oauth.cannotGrant')}
                                      />
                                    </li>
                                  )}
                                </For>
                              </ul>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* Account scopes (everything but bot). */}
                      <Show when={d().scopes.some((s) => s !== 'bot')}>
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('oauth.willBeAbleTo')}</p>
                          <ul class="mt-2 space-y-2.5">
                            <For each={d().scopes.filter((s) => s !== 'bot')}>
                              {(scope) => (
                                <li class="flex items-start gap-3">
                                  <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                                    <i class={`fa-solid ${SCOPE_ICON[scope] ?? 'fa-circle-check'} text-[11px]`} aria-hidden="true" />
                                  </span>
                                  <span class="text-sm text-foreground">{t(`oauth.scopes.${scopeKey(scope)}`)}</span>
                                </li>
                              )}
                            </For>
                          </ul>
                        </div>
                      </Show>
                      <Show when={error()}>
                        <p class="text-sm text-destructive">{error()}</p>
                      </Show>
                    </CardContent>
                    <CardFooter class={`${authCardFooterClass} flex-row gap-2`}>
                      <Button variant="ghost" class="flex-1" onClick={deny} disabled={busy()}>
                        {t('oauth.cancel')}
                      </Button>
                      <Button
                        class="flex-1 font-semibold"
                        loading={busy()}
                        disabled={wantsBot() && (targets().length === 0 || !spaceId())}
                        onClick={() => void approve()}
                      >
                        {wantsBot() ? t('oauth.authorizeBot') : t('oauth.authorize')}
                      </Button>
                    </CardFooter>
                  </Show>
                )}
              </Show>
            </ErrorBoundary>
          </Show>
        </Card>
      </div>
    </div>
  );
};

export default OAuthAuthorizePage;
