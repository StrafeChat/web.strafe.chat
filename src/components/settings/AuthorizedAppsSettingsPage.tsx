import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { listGrants, revokeGrant, scopeKey, type OAuthGrant } from '../../api/developers';
import { confirmDialog } from '../../stores/confirmDialog';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { settingsRowShell } from './settingsChrome';
import { formatDate, t } from '../../i18n';

/**
 * Account → Authorized Apps: every third-party application this account has granted
 * access to, what each may do (its scopes), and a way to take that access back. Revoking
 * kills the application's tokens for this account on the spot.
 */
export const AuthorizedAppsSettingsPage: Component = () => {
  const [grants, setGrants] = createSignal<OAuthGrant[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal('');

  async function refresh() {
    setLoading(true);
    try {
      setGrants(await listGrants());
      setError('');
    } catch {
      setError(t('settings.authorizedApps.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  const appName = (g: OAuthGrant) => g.application?.name || t('settings.authorizedApps.unknownApp');

  async function revoke(g: OAuthGrant) {
    const ok = await confirmDialog({
      title: t('settings.authorizedApps.revoke'),
      body: t('settings.authorizedApps.revokeConfirm', { name: appName(g) }),
      confirmLabel: t('settings.authorizedApps.revoke'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(g.application_id);
    try {
      await revokeGrant(g.application_id);
      setGrants((prev) => prev.filter((x) => x.application_id !== g.application_id));
    } catch {
      setError(t('settings.authorizedApps.revokeFailed'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div class="space-y-4">
      <p class="px-0.5 text-sm text-muted-foreground">{t('settings.authorizedApps.intro')}</p>
      <Show when={error()}>
        <p class="px-0.5 text-sm text-destructive">{error()}</p>
      </Show>
      <Show when={!loading()} fallback={<p class="px-0.5 text-sm text-muted-foreground">…</p>}>
        <Show
          when={grants().length > 0}
          fallback={<EmptyState icon="fa-solid fa-plug" title={t('settings.authorizedApps.empty')} />}
        >
          <div class="space-y-2">
            <For each={grants()}>
              {(g) => (
                <div class={`${settingsRowShell} items-start`}>
                  <MessageAvatar name={appName(g)} avatar={g.application?.icon} class="size-10 text-sm" />
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <div class="flex flex-wrap items-baseline gap-x-2">
                      <span class="truncate text-sm font-medium text-foreground">{appName(g)}</span>
                      <span class="text-xs text-muted-foreground">
                        {t('settings.authorizedApps.since', { when: formatDate(g.created_at, { dateStyle: 'medium' }) })}
                      </span>
                    </div>
                    <Show when={g.application?.description}>
                      <p class="text-xs text-muted-foreground">{g.application!.description}</p>
                    </Show>
                    <ul class="space-y-1">
                      <For each={g.scopes}>
                        {(scope) => (
                          <li class="flex items-center gap-2 text-xs text-foreground/90">
                            <i class="fa-solid fa-check text-[10px] text-primary" aria-hidden="true" />
                            <span>{t(`oauth.scopes.${scopeKey(scope)}`, { defaultValue: scope })}</span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    loading={busy() === g.application_id}
                    onClick={() => void revoke(g)}
                  >
                    {t('settings.authorizedApps.revoke')}
                  </Button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};
