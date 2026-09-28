import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show, batch } from 'solid-js';
import {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  resetApplicationSecret,
  addBot,
  resetBotToken,
  type Application,
} from '../../api/developers';
import { confirmDialog } from '../../stores/confirmDialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { formatDiscriminator } from './types.js';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';

/** A client secret or bot token the server returned once; kept in memory only until dismissed. */
interface Secret {
  labelKey: string;
  value: string;
}

/**
 * The Developers section: an account's OAuth2 applications and their bots. The list opens
 * into a per-app detail where name, description and redirect URIs are edited, the client
 * secret is reset, and a bot user is attached. Client secrets and bot tokens are shown
 * exactly once (right after they are minted) - the server never returns them again.
 */
export const DevelopersSettingsPage: Component = () => {
  const [apps, setApps] = createSignal<Application[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [selected, setSelected] = createSignal<Application | null>(null);

  const [createOpen, setCreateOpen] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [createErr, setCreateErr] = createSignal('');

  // A freshly minted secret/token, shown once in a banner at the top of the detail view.
  const [secret, setSecret] = createSignal<Secret | null>(null);
  const [copied, setCopied] = createSignal('');

  // Detail form state, seeded whenever a detail view opens.
  const [fName, setFName] = createSignal('');
  const [fDesc, setFDesc] = createSignal('');
  const [fRedirects, setFRedirects] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [detailBusy, setDetailBusy] = createSignal(false);
  const [detailErr, setDetailErr] = createSignal('');

  async function refresh() {
    setLoading(true);
    try {
      setApps(await listApplications());
      setError('');
    } catch {
      setError(t('settings.developers.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  function openDetail(app: Application, freshSecret?: Secret) {
    batch(() => {
      setSelected(app);
      setFName(app.name);
      setFDesc(app.description);
      setFRedirects(app.redirect_uris.join('\n'));
      setDetailErr('');
      setSecret(freshSecret ?? null);
    });
  }

  function closeDetail() {
    batch(() => {
      setSelected(null);
      setSecret(null);
    });
  }

  function replaceApp(app: Application) {
    setApps((prev) => prev.map((a) => (a.id === app.id ? app : a)));
    setSelected(app);
  }

  async function create() {
    const name = newName().trim();
    if (!name) return;
    setCreating(true);
    setCreateErr('');
    try {
      const app = await createApplication(name);
      setApps((prev) => [app, ...prev]);
      setCreateOpen(false);
      setNewName('');
      openDetail(app, { labelKey: 'settings.developers.clientSecret', value: app.client_secret });
    } catch {
      setCreateErr(t('settings.developers.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    const app = selected();
    if (!app) return;
    const redirect_uris = fRedirects()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    setDetailErr('');
    try {
      const updated = await updateApplication(app.id, {
        name: fName().trim(),
        description: fDesc().trim(),
        redirect_uris,
      });
      replaceApp(updated);
      setFRedirects(updated.redirect_uris.join('\n'));
    } catch {
      setDetailErr(t('settings.developers.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const dirty = () => {
    const app = selected();
    if (!app) return false;
    const redirects = fRedirects()
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      fName().trim() !== app.name ||
      fDesc().trim() !== app.description ||
      redirects.join('\n') !== app.redirect_uris.join('\n')
    );
  };

  async function resetSecret() {
    const app = selected();
    if (!app) return;
    const ok = await confirmDialog({
      title: t('settings.developers.resetSecret'),
      body: t('settings.developers.resetSecretConfirm'),
      confirmLabel: t('settings.developers.resetSecret'),
      tone: 'danger',
    });
    if (!ok) return;
    setDetailBusy(true);
    setDetailErr('');
    try {
      const { client_secret } = await resetApplicationSecret(app.id);
      setSecret({ labelKey: 'settings.developers.clientSecret', value: client_secret });
    } catch {
      setDetailErr(t('settings.developers.actionFailed'));
    } finally {
      setDetailBusy(false);
    }
  }

  async function attachBot() {
    const app = selected();
    if (!app) return;
    setDetailBusy(true);
    setDetailErr('');
    try {
      const bot = await addBot(app.id);
      const updated = await getApplication(app.id);
      replaceApp(updated);
      setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSecret({ labelKey: 'settings.developers.botToken', value: bot.token });
    } catch {
      setDetailErr(t('settings.developers.actionFailed'));
    } finally {
      setDetailBusy(false);
    }
  }

  async function regenBotToken() {
    const app = selected();
    if (!app) return;
    const ok = await confirmDialog({
      title: t('settings.developers.resetToken'),
      body: t('settings.developers.resetTokenConfirm'),
      confirmLabel: t('settings.developers.resetToken'),
      tone: 'danger',
    });
    if (!ok) return;
    setDetailBusy(true);
    setDetailErr('');
    try {
      const { token } = await resetBotToken(app.id);
      setSecret({ labelKey: 'settings.developers.botToken', value: token });
    } catch {
      setDetailErr(t('settings.developers.actionFailed'));
    } finally {
      setDetailBusy(false);
    }
  }

  async function remove() {
    const app = selected();
    if (!app) return;
    const ok = await confirmDialog({
      title: t('settings.developers.deleteApp'),
      body: t('settings.developers.deleteConfirm', { name: app.name }),
      confirmLabel: t('settings.developers.deleteApp'),
      tone: 'danger',
    });
    if (!ok) return;
    setDetailBusy(true);
    try {
      await deleteApplication(app.id);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      closeDetail();
    } catch {
      setDetailErr(t('settings.developers.actionFailed'));
    } finally {
      setDetailBusy(false);
    }
  }

  function copy(key: string, value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1500);
    });
  }

  return (
    <Show
      when={selected()}
      fallback={
        <div class="space-y-4">
          <p class="px-0.5 text-sm text-muted-foreground">{t('settings.developers.intro')}</p>
          <Button onClick={() => setCreateOpen(true)} class="w-full sm:w-auto">
            <i class="fa-solid fa-plus text-xs" aria-hidden="true" /> {t('settings.developers.newApp')}
          </Button>

          <Show when={error()}>
            <p class="px-0.5 text-sm text-destructive">{error()}</p>
          </Show>

          <Show when={!loading()} fallback={<p class="px-0.5 text-sm text-muted-foreground">…</p>}>
            <Show
              when={apps().length > 0}
              fallback={<p class="px-0.5 text-sm text-muted-foreground">{t('settings.developers.empty')}</p>}
            >
              <div class="space-y-2">
                <For each={apps()}>
                  {(app) => (
                    <button type="button" class={`${settingsRowShell} w-full text-start`} onClick={() => openDetail(app)}>
                      <MessageAvatar name={app.name} avatar={app.icon} class="size-10 text-sm" />
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-medium text-foreground">{app.name}</div>
                        <div class="truncate text-xs text-muted-foreground">
                          {app.has_bot ? t('settings.developers.withBot') : t('settings.developers.noBot')}
                        </div>
                      </div>
                      <Show when={app.has_bot}>
                        <span class="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          {t('badges.botTag')}
                        </span>
                      </Show>
                      <i class="fa-solid fa-chevron-right text-xs text-muted-foreground" aria-hidden="true" />
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={createOpen()}>
          <ResponsiveDialog
            onClose={() => !creating() && setCreateOpen(false)}
            size="sm"
            icon="fa-solid fa-code"
            title={t('settings.developers.newApp')}
            description={t('settings.developers.newAppHint')}
          >
            <form
              class="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <Input
                type="text"
                label={t('settings.developers.name')}
                placeholder={t('settings.developers.namePlaceholder')}
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                maxlength={80}
                error={createErr()}
                autofocus
              />
              <div class="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating()}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={creating()} disabled={!newName().trim()}>
                  {t('settings.developers.create')}
                </Button>
              </div>
            </form>
          </ResponsiveDialog>
          </Show>
        </div>
      }
    >
      {(app) => (
        <div class="space-y-5">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            onClick={closeDetail}
          >
            <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true" /> {t('settings.developers.backToApps')}
          </button>

          <div class="flex items-center gap-3">
            <MessageAvatar name={app().name} avatar={app().icon} class="size-12 text-lg" />
            <div class="min-w-0">
              <div class="truncate text-lg font-bold text-foreground">{app().name}</div>
              <div class="truncate text-xs text-muted-foreground">
                {t('settings.developers.created', { when: formatDate(app().created_at, { dateStyle: 'medium' }) })}
              </div>
            </div>
          </div>

          {/* Once-shown secret/token banner. */}
          <Show when={secret()}>
            {(s) => (
              <div class="space-y-2 rounded-xl border border-primary/40 bg-primary/10 p-4">
                <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <i class="fa-solid fa-triangle-exclamation text-primary" aria-hidden="true" />
                  {t('settings.developers.secretOnce', { what: t(s().labelKey) })}
                </div>
                <div class="flex items-center gap-2">
                  <code class="min-w-0 flex-1 truncate rounded-md bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
                    {s().value}
                  </code>
                  <Button size="sm" variant="secondary" onClick={() => copy('secret', s().value)}>
                    {copied() === 'secret' ? t('common.copied') : t('common.copy')}
                  </Button>
                </div>
                <button type="button" class="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSecret(null)}>
                  {t('settings.developers.dismiss')}
                </button>
              </div>
            )}
          </Show>

          <Show when={detailErr()}>
            <p class="px-0.5 text-sm text-destructive">{detailErr()}</p>
          </Show>

          {/* General */}
          <div class={`${settingsGroupFrame} space-y-3`}>
            <Input
              type="text"
              label={t('settings.developers.name')}
              value={fName()}
              onInput={(e) => setFName(e.currentTarget.value)}
              maxlength={80}
            />
            <Textarea
              label={t('settings.developers.description')}
              value={fDesc()}
              onInput={(e) => setFDesc(e.currentTarget.value)}
              maxlength={400}
              rows={2}
            />
            <Textarea
              label={t('settings.developers.redirects')}
              hint={t('settings.developers.redirectsHint')}
              value={fRedirects()}
              onInput={(e) => setFRedirects(e.currentTarget.value)}
              rows={3}
              spellcheck={false}
              class="font-mono text-xs"
            />
            <Button onClick={() => void save()} loading={saving()} disabled={!dirty()} class="w-full sm:w-auto">
              {t('common.saveChanges')}
            </Button>
          </div>

          {/* OAuth2 credentials */}
          <div class={settingsSectionTitle}>{t('settings.developers.oauthTitle')}</div>
          <div class={`${settingsGroupFrame} space-y-3`}>
            <div class="space-y-1.5">
              <div class="text-xs font-medium text-muted-foreground">{t('settings.developers.clientId')}</div>
              <div class="flex items-center gap-2">
                <code class="min-w-0 flex-1 truncate rounded-md bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
                  {app().client_id}
                </code>
                <Button size="sm" variant="ghost" onClick={() => copy('cid', app().client_id)}>
                  {copied() === 'cid' ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
            </div>
            <div class="space-y-1.5">
              <div class="text-xs font-medium text-muted-foreground">{t('settings.developers.clientSecret')}</div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-muted-foreground">{t('settings.developers.secretHidden')}</span>
                <Button size="sm" variant="ghost" loading={detailBusy()} onClick={() => void resetSecret()}>
                  {t('settings.developers.resetSecret')}
                </Button>
              </div>
            </div>
          </div>

          {/* Bot */}
          <div class={settingsSectionTitle}>{t('settings.developers.botTitle')}</div>
          <div class={`${settingsGroupFrame} space-y-3`}>
            <Show
              when={app().has_bot}
              fallback={
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm text-muted-foreground">{t('settings.developers.botHint')}</p>
                  <Button size="sm" loading={detailBusy()} onClick={() => void attachBot()}>
                    {t('settings.developers.addBot')}
                  </Button>
                </div>
              }
            >
              <div class="flex items-center gap-3">
                <div class={settingsRowIcon}><i class="fa-solid fa-robot" aria-hidden="true" /></div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-foreground">{t('settings.developers.botActive')}</div>
                  <div class="truncate text-xs text-muted-foreground">{t('settings.developers.botActiveHint')}</div>
                </div>
                <Button size="sm" variant="ghost" loading={detailBusy()} onClick={() => void regenBotToken()}>
                  {t('settings.developers.resetToken')}
                </Button>
              </div>
            </Show>
          </div>

          {/* Danger */}
          <div class="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3.5">
            <div class="min-w-0">
              <div class="text-sm font-medium text-foreground">{t('settings.developers.deleteApp')}</div>
              <div class="text-xs text-muted-foreground">{t('settings.developers.deleteHint')}</div>
            </div>
            <Button size="sm" variant="destructive" loading={detailBusy()} onClick={() => void remove()}>
              {t('settings.developers.deleteApp')}
            </Button>
          </div>
        </div>
      )}
    </Show>
  );
};
