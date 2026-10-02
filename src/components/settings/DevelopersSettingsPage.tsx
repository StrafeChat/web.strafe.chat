import type { Component } from 'solid-js';
import { createSignal, createMemo, onMount, For, Show, batch } from 'solid-js';
import {
  listApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  resetApplicationSecret,
  addBot,
  resetBotToken,
  updateBotProfile,
  uploadBotAvatar,
  uploadBotBanner,
  authorizeUrl,
  scopeKey,
  OAUTH_SCOPES,
  type Application,
  type BotProfile,
  type OAuthScope,
} from '../../api/developers';
import { BotTag } from '../BotTag';
import { confirmDialog } from '../../stores/confirmDialog';
import { PermAdministrator, SPACE_ROLE_PERM_GROUPS } from '../../lib/spacePermissions';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Toggle } from '../ui/Toggle';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { formatDiscriminator } from './types.js';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { BotDiscoverSection } from './BotDiscoverSection';
import { formatDate, t } from '../../i18n';

/** A client secret or bot token the server returned once; kept in memory only until dismissed. */
interface Secret {
  labelKey: string;
  value: string;
}

/** Where the developer documentation lives on this instance (built into the web image). */
export const DOCS_URL = '/docs/';

/**
 * The Developers section: an account's OAuth2 applications and their bots. The list opens
 * into a per-app detail where name, description and redirect URIs are edited, the client
 * secret is reset, a bot user is attached (with its public/private switch and an "add to a
 * space" shortcut), and an OAuth2 URL generator builds authorization links from scopes and
 * bot permissions. Client secrets and bot tokens are shown exactly once (right after they
 * are minted) - the server never returns them again.
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

  // Bot profile editor state (seeded from app.bot when a detail view opens).
  const [bName, setBName] = createSignal('');
  const [bAbout, setBAbout] = createSignal('');
  const [bBio, setBBio] = createSignal('');
  const [botSaving, setBotSaving] = createSignal(false);
  const [botAvatarUploading, setBotAvatarUploading] = createSignal(false);
  const [botBannerUploading, setBotBannerUploading] = createSignal(false);
  const [botMediaErr, setBotMediaErr] = createSignal('');
  let botAvatarInput: HTMLInputElement | undefined;
  let botBannerInput: HTMLInputElement | undefined;
  const BOT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

  // URL generator state.
  const [genScopes, setGenScopes] = createSignal<Set<OAuthScope>>(new Set(['identify']));
  const [genPerms, setGenPerms] = createSignal(0);
  const [genRedirect, setGenRedirect] = createSignal('');

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
      setGenScopes(new Set<OAuthScope>(app.has_bot ? ['bot'] : ['identify']));
      setGenPerms(0);
      setGenRedirect(app.redirect_uris[0] ?? '');
      seedBotForm(app.bot);
      setBotMediaErr('');
    });
  }

  function seedBotForm(bot: BotProfile | undefined) {
    setBName(bot?.display_name ?? '');
    setBAbout(bot?.about_me ?? '');
    setBBio(bot?.bio ?? '');
  }

  /** Swap the bot profile on the selected app (and in the list) after an edit or upload. */
  function replaceBot(bot: BotProfile) {
    const app = selected();
    if (!app) return;
    replaceApp({ ...app, bot });
  }

  const botDirty = () => {
    const bot = selected()?.bot;
    if (!bot) return false;
    return bName().trim() !== (bot.display_name ?? '') || bAbout().trim() !== (bot.about_me ?? '') || bBio().trim() !== (bot.bio ?? '');
  };

  async function saveBotProfile() {
    const app = selected();
    if (!app?.bot) return;
    setBotSaving(true);
    setDetailErr('');
    try {
      const bot = await updateBotProfile(app.id, { display_name: bName().trim(), about_me: bAbout().trim(), bio: bBio().trim() });
      replaceBot(bot);
      seedBotForm(bot);
    } catch (err) {
      setDetailErr(err instanceof Error ? err.message : t('settings.developers.saveFailed'));
    } finally {
      setBotSaving(false);
    }
  }

  async function onBotImagePicked(e: Event, kind: 'avatar' | 'banner') {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const app = selected();
    if (!file || !app?.bot) return;
    if (!file.type.startsWith('image/')) {
      setBotMediaErr(t('settings.profile.imageTypeError'));
      return;
    }
    if (file.size > BOT_IMAGE_MAX_BYTES) {
      setBotMediaErr(t('settings.profile.imageSizeError'));
      return;
    }
    setBotMediaErr('');
    const setBusy = kind === 'avatar' ? setBotAvatarUploading : setBotBannerUploading;
    setBusy(true);
    try {
      const bot = kind === 'avatar' ? await uploadBotAvatar(app.id, file) : await uploadBotBanner(app.id, file);
      replaceBot(bot);
    } catch (err) {
      setBotMediaErr(err instanceof Error ? err.message : t('settings.profile.uploadFailed'));
    } finally {
      setBusy(false);
    }
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
      if (!updated.redirect_uris.includes(genRedirect())) setGenRedirect(updated.redirect_uris[0] ?? '');
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
      seedBotForm(updated.bot);
      setSecret({ labelKey: 'settings.developers.botToken', value: bot.token });
      setGenScopes(new Set<OAuthScope>(['bot']));
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

  async function setBotPublic(on: boolean) {
    const app = selected();
    if (!app) return;
    setDetailBusy(true);
    setDetailErr('');
    try {
      replaceApp(await updateApplication(app.id, { bot_public: on }));
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

  // ---- URL generator ----
  function toggleScope(scope: OAuthScope, on: boolean) {
    setGenScopes((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });
  }
  function togglePerm(bit: number, on: boolean) {
    setGenPerms((cur) => (on ? cur | bit : cur & ~bit));
  }
  const genHasBot = () => genScopes().has('bot');
  /** Every scope but a bare `bot` needs somewhere to deliver the code. */
  const genNeedsRedirect = () => [...genScopes()].some((s) => s !== 'bot');
  const genRedirectMissing = () => genNeedsRedirect() && !genRedirect();
  const generatedUrl = createMemo(() => {
    const app = selected();
    if (!app || genScopes().size === 0 || genRedirectMissing()) return '';
    return authorizeUrl({
      clientId: app.client_id,
      scopes: OAUTH_SCOPES.filter((s) => genScopes().has(s)),
      redirectUri: genNeedsRedirect() ? genRedirect() : undefined,
      permissions: genHasBot() ? genPerms() : undefined,
    });
  });
  /** The quick "add my bot" link: bot scope with the generator's permissions, no redirect. */
  const installUrl = () => {
    const app = selected();
    if (!app?.has_bot) return '';
    return authorizeUrl({ clientId: app.client_id, scopes: ['bot'], permissions: genPerms() });
  };

  return (
    <Show
      when={selected()}
      fallback={
        <div class="space-y-4">
          <p class="px-0.5 text-sm text-muted-foreground">{t('settings.developers.intro')}</p>
          <div class="flex flex-wrap items-center gap-2">
            <Button onClick={() => setCreateOpen(true)} class="w-full sm:w-auto">
              <i class="fa-solid fa-plus text-xs" aria-hidden="true" /> {t('settings.developers.newApp')}
            </Button>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener"
              class="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              <i class="fa-solid fa-book text-xs" aria-hidden="true" /> {t('settings.developers.docs')}
            </a>
          </div>

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
          <div class="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={closeDetail}
            >
              <i class="fa-solid fa-chevron-left text-xs" aria-hidden="true" /> {t('settings.developers.backToApps')}
            </button>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <i class="fa-solid fa-book text-[11px]" aria-hidden="true" /> {t('settings.developers.docs')}
            </a>
          </div>

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

          {/* Bot */}
          <div class={settingsSectionTitle}>{t('settings.developers.botTitle')}</div>
          <div class={`${settingsGroupFrame} space-y-4`}>
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
                <Show when={app().bot} fallback={<div class={settingsRowIcon}><i class="fa-solid fa-robot" aria-hidden="true" /></div>}>
                  {(bot) => <MessageAvatar name={bot().display_name || bot().username} avatar={bot().avatar} class="size-10 text-sm" />}
                </Show>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center text-sm font-medium text-foreground">
                    <span class="truncate">{app().bot?.display_name || app().bot?.username || t('settings.developers.botActive')}</span>
                    <BotTag bot size="sm" />
                  </div>
                  <div class="truncate font-mono text-xs text-muted-foreground">
                    <Show when={app().bot} fallback={t('settings.developers.botActiveHint')}>
                      {(bot) => `${bot().username}#${formatDiscriminator(Number(bot().discriminator))} · ${bot().id}`}
                    </Show>
                  </div>
                </div>
                <Button size="sm" variant="ghost" loading={detailBusy()} onClick={() => void regenBotToken()}>
                  {t('settings.developers.resetToken')}
                </Button>
              </div>

              <div class="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{t('settings.developers.publicBot')}</div>
                  <div class="text-xs text-muted-foreground">{t('settings.developers.publicBotHint')}</div>
                </div>
                <Toggle
                  checked={app().bot_public}
                  disabled={detailBusy()}
                  label={t('settings.developers.publicBot')}
                  onChange={(on) => void setBotPublic(on)}
                />
              </div>

              <div class="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{t('settings.developers.addToSpace')}</div>
                  <div class="text-xs text-muted-foreground">{t('settings.developers.addToSpaceHint')}</div>
                </div>
                <a
                  href={installUrl()}
                  target="_blank"
                  rel="noopener"
                  class="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <i class="fa-solid fa-plus text-[10px]" aria-hidden="true" /> {t('settings.developers.addToSpace')}
                </a>
              </div>
            </Show>
          </div>

          {/* Discover: list the bot on this instance's directory. */}
          <Show when={app().has_bot}>
            <div class={settingsGroupFrame}>
              <BotDiscoverSection app={app()} />
            </div>
          </Show>

          {/* Bot profile: how the bot looks to everyone. */}
          <Show when={app().bot}>
            {(bot) => (
              <>
                <div class={settingsSectionTitle}>{t('settings.developers.botProfile')}</div>
                <div class={`${settingsGroupFrame} space-y-4`}>
                  <p class="text-xs text-muted-foreground">{t('settings.developers.botProfileHint')}</p>
                  <div class="overflow-hidden rounded-xl border border-border bg-muted/15">
                    <input
                      ref={(el) => {
                        botAvatarInput = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      class="hidden"
                      onChange={(e) => void onBotImagePicked(e, 'avatar')}
                    />
                    <input
                      ref={(el) => {
                        botBannerInput = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      class="hidden"
                      onChange={(e) => void onBotImagePicked(e, 'banner')}
                    />
                    <button
                      type="button"
                      disabled={botBannerUploading()}
                      title={t('settings.profile.changeBanner')}
                      aria-label={t('settings.profile.changeBannerAria')}
                      class="group/banner relative flex h-24 w-full cursor-pointer border-0 bg-gradient-to-br from-primary/30 to-primary/10 bg-cover bg-center p-0 text-start outline-none ring-inset ring-ring transition focus-visible:ring-2 disabled:cursor-wait disabled:opacity-70"
                      style={bot().banner ? { 'background-image': `url(${bot().banner})` } : undefined}
                      onClick={() => {
                        if (!botBannerUploading()) botBannerInput?.click();
                      }}
                    >
                      <span class="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/banner:bg-black/50 group-focus-visible/banner:bg-black/45" />
                      <span class="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium text-white opacity-0 transition-opacity group-hover/banner:opacity-100 group-focus-visible/banner:opacity-100">
                        {t('settings.profile.changeBanner')}
                      </span>
                      <Show when={botBannerUploading()}>
                        <span class="absolute inset-0 z-[1] flex items-center justify-center bg-background/60 text-sm font-medium text-foreground backdrop-blur-[2px]">
                          {t('common.uploading')}
                        </span>
                      </Show>
                    </button>
                    <div class="flex items-end gap-3 px-4 pb-3 pt-1">
                      <button
                        type="button"
                        disabled={botAvatarUploading()}
                        title={t('settings.profile.changeAvatar')}
                        aria-label={t('settings.profile.changeAvatarAria')}
                        class="group/avatar relative -mt-10 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 ring-offset-card transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
                        onClick={() => {
                          if (!botAvatarUploading()) botAvatarInput?.click();
                        }}
                      >
                        <span class="relative block rounded-full">
                          <MessageAvatar
                            name={bName() || bot().display_name || bot().username}
                            avatar={bot().avatar}
                            class="pointer-events-none size-16 border-[3px] border-card bg-primary text-lg text-primary-foreground shadow-md"
                          />
                          <span class="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover/avatar:bg-black/55 group-focus-visible/avatar:bg-black/50" />
                          <span class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full px-2 text-center text-[10px] font-semibold leading-tight text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100">
                            {t('settings.profile.changeAvatar')}
                          </span>
                        </span>
                        <Show when={botAvatarUploading()}>
                          <span class="absolute inset-0 z-[2] flex items-center justify-center rounded-full bg-background/60 text-[11px] font-medium text-foreground backdrop-blur-[2px]">
                            …
                          </span>
                        </Show>
                      </button>
                      <div class="min-w-0 flex-1 pb-1">
                        <div class="flex items-center text-sm font-semibold text-foreground">
                          <span class="truncate">{bName().trim() || bot().display_name || bot().username}</span>
                          <BotTag bot size="sm" />
                        </div>
                        <p class="text-[11px] text-muted-foreground">{t('settings.profile.mediaHint')}</p>
                        <Show when={botMediaErr()}>
                          <p class="text-xs text-destructive">{botMediaErr()}</p>
                        </Show>
                      </div>
                    </div>
                  </div>
                  <Input
                    type="text"
                    label={t('settings.developers.botDisplayName')}
                    value={bName()}
                    onInput={(e) => setBName(e.currentTarget.value)}
                    maxlength={32}
                  />
                  <Textarea
                    label={t('settings.developers.botAboutMe')}
                    hint={t('settings.profile.aboutMeHint')}
                    placeholder={t('settings.profile.aboutMePlaceholder')}
                    value={bAbout()}
                    onInput={(e) => setBAbout(e.currentTarget.value)}
                    maxlength={190}
                    rows={2}
                  />
                  <Textarea
                    label={t('settings.developers.botBio')}
                    hint={t('settings.profile.bioHint')}
                    placeholder={t('settings.profile.bioPlaceholder')}
                    value={bBio()}
                    onInput={(e) => setBBio(e.currentTarget.value)}
                    maxlength={190}
                    rows={3}
                  />
                  <Button onClick={() => void saveBotProfile()} loading={botSaving()} disabled={!botDirty()} class="w-full sm:w-auto">
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </>
            )}
          </Show>

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

          {/* URL generator */}
          <div class={settingsSectionTitle}>{t('settings.developers.urlGenerator')}</div>
          <div class={`${settingsGroupFrame} space-y-4`}>
            <p class="text-xs text-muted-foreground">{t('settings.developers.urlGeneratorHint')}</p>

            <div>
              <div class="mb-2 text-xs font-medium text-muted-foreground">{t('settings.developers.scopes')}</div>
              <div class="grid gap-2 sm:grid-cols-2">
                <For each={OAUTH_SCOPES}>
                  {(scope) => (
                    <Checkbox
                      checked={genScopes().has(scope)}
                      disabled={scope === 'bot' && !app().has_bot}
                      onChange={(on) => toggleScope(scope, on)}
                      label={<span class="font-mono text-xs">{scope}</span>}
                      description={
                        scope === 'bot' && !app().has_bot
                          ? t('settings.developers.botScopeNeedsBot')
                          : t(`oauth.scopes.${scopeKey(scope)}`)
                      }
                    />
                  )}
                </For>
              </div>
            </div>

            <Show when={genHasBot()}>
              <div>
                <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span class="text-xs font-medium text-muted-foreground">{t('settings.developers.botPermissions')}</span>
                  <span class="font-mono text-xs text-muted-foreground">
                    {t('settings.developers.permissionsValue', { value: String(genPerms()) })}
                  </span>
                </div>
                <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <For each={SPACE_ROLE_PERM_GROUPS}>
                    {(group) => (
                      <div class="space-y-1.5">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{group.category}</div>
                        <For each={group.rows}>
                          {(r) => (
                            <Checkbox
                              checked={(genPerms() & r.bit) !== 0}
                              onChange={(on) => togglePerm(r.bit, on)}
                              label={r.label}
                            />
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={(genPerms() & PermAdministrator) !== 0}>
                  <p class="mt-2 text-xs text-destructive">{t('settings.developers.administratorWarning')}</p>
                </Show>
              </div>
            </Show>

            <Show when={genNeedsRedirect()}>
              <Show
                when={app().redirect_uris.length > 0}
                fallback={<p class="text-xs text-destructive">{t('settings.developers.redirectRequired')}</p>}
              >
                <Select label={t('settings.developers.redirectUri')} value={genRedirect()} onValueChange={setGenRedirect}>
                  <For each={app().redirect_uris}>{(u) => <option value={u}>{u}</option>}</For>
                </Select>
              </Show>
            </Show>

            <div class="space-y-1.5">
              <div class="text-xs font-medium text-muted-foreground">{t('settings.developers.generatedUrl')}</div>
              <Show
                when={generatedUrl()}
                fallback={<p class="text-xs text-muted-foreground">{t('settings.developers.generatedUrlEmpty')}</p>}
              >
                <div class="flex items-center gap-2">
                  <code class="min-w-0 flex-1 truncate rounded-md bg-background/70 px-3 py-2 font-mono text-xs text-foreground">
                    {generatedUrl()}
                  </code>
                  <Button size="sm" variant="secondary" onClick={() => copy('url', generatedUrl())}>
                    {copied() === 'url' ? t('common.copied') : t('settings.developers.copyUrl')}
                  </Button>
                  <a
                    href={generatedUrl()}
                    target="_blank"
                    rel="noopener"
                    class="inline-flex h-8 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted/40"
                  >
                    {t('settings.developers.openUrl')}
                  </a>
                </div>
              </Show>
            </div>
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
