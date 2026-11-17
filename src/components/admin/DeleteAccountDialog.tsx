import type { Component } from 'solid-js';
import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import {
  deleteAccount,
  getAccountDeletionPreview,
  type AccountDeletionPreview,
  type AccountDeletionResult,
  type AdminUser,
  type DeletionBlockers,
  type DeletionCounts,
} from '../../api/instance';
import { isApiError } from '../../api/ApiError';
import { formatHandle } from '../../stores/instance';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { settingsGroupFrame, settingsSectionTitle } from '../settings/settingsChrome';
import { appDialogActions, zLayer } from '../../theme/appChrome';
import { translateAccountDeletionError } from '../../lib/formatApiError';
import { t } from '../../i18n';

/** Preview count field -> its line in admin.users.delete.count.*, in the order they are listed. */
const COUNT_LINES: { field: keyof DeletionCounts; key: string; icon: string }[] = [
  { field: 'sessions', key: 'sessions', icon: 'fa-laptop' },
  { field: 'devices', key: 'devices', icon: 'fa-key' },
  { field: 'spaces', key: 'spaces', icon: 'fa-layer-group' },
  { field: 'friends', key: 'friends', icon: 'fa-user-group' },
  { field: 'pending_requests', key: 'pendingRequests', icon: 'fa-user-clock' },
  { field: 'group_pms', key: 'groupPms', icon: 'fa-users' },
  { field: 'pms', key: 'pms', icon: 'fa-message' },
  { field: 'authorized_apps', key: 'authorizedApps', icon: 'fa-plug' },
  { field: 'push_subscriptions', key: 'pushSubscriptions', icon: 'fa-bell' },
  { field: 'open_reports_about', key: 'openReports', icon: 'fa-flag' },
];

const nameOf = (u: AdminUser | null | undefined) => u?.display_name || u?.username || t('common.unknown');

/**
 * The instance administrator's two-step delete for a local account or bot: review what goes
 * and what stands in the way (owned spaces, owned applications), then type the exact
 * username. The server re-checks everything - refusals, blockers and the typed name - so
 * this dialog only keeps an administrator from asking for something it would refuse.
 */
export const DeleteAccountDialog: Component<{
  /** Opens the dialog for this account; null closes it. */
  user: AdminUser | null;
  /** The account is under an instance ban: deleting it frees the way to register again. */
  banned: boolean;
  onClose: () => void;
  onDeleted: (result: AccountDeletionResult) => void;
  onOpenSpace: (id: string) => void;
}> = (props) => {
  const [step, setStep] = createSignal<'review' | 'confirm'>('review');
  const [takeDown, setTakeDown] = createSignal(false);
  const [deleteApps, setDeleteApps] = createSignal(false);
  const [typed, setTyped] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  /** Fresher blockers from a 409, overriding the preview's until it is loaded again. */
  const [freshBlockers, setFreshBlockers] = createSignal<DeletionBlockers | null>(null);

  const [previewRes, { refetch }] = createResource(
    () => props.user?.id ?? null,
    (id) => getAccountDeletionPreview(id),
  );

  // A new account (or reopening) starts over.
  createEffect(() => {
    void props.user?.id;
    setStep('review');
    setTakeDown(false);
    setDeleteApps(false);
    setTyped('');
    setError('');
    setFreshBlockers(null);
  });

  const preview = (): AccountDeletionPreview | undefined => (previewRes.state === 'ready' ? previewRes() : previewRes.latest);
  const blockers = createMemo<DeletionBlockers>(() => {
    const b = freshBlockers() ?? preview()?.blockers;
    return { owned_spaces: b?.owned_spaces ?? [], owned_applications: b?.owned_applications ?? [] };
  });
  const localSpaces = () => blockers().owned_spaces.filter((s) => !s.hosted_on);
  const remoteSpaces = () => blockers().owned_spaces.filter((s) => !!s.hosted_on);
  const apps = () => blockers().owned_applications;
  const username = () => preview()?.user.username ?? props.user?.username ?? '';
  const isBot = () => (preview()?.kind ?? (props.user?.bot ? 'bot' : 'user')) === 'bot';
  const countLines = () => {
    const c = preview()?.counts ?? {};
    return COUNT_LINES.map((l) => ({ ...l, count: c[l.field] ?? 0 })).filter((l) => l.count > 0);
  };
  const remoteInstances = () => preview()?.counts.remote_instances ?? 0;

  const canContinue = () =>
    !!preview() &&
    !preview()!.refusal &&
    remoteSpaces().length === 0 &&
    (localSpaces().length === 0 || takeDown()) &&
    (apps().length === 0 || deleteApps());
  // The server trims what was typed, then compares case-sensitively; so does this.
  const confirmed = () => !!username() && typed().trim() === username();

  async function submit(e: Event) {
    e.preventDefault();
    const u = props.user;
    if (!u || !confirmed() || busy()) return;
    setBusy(true);
    setError('');
    try {
      const result = await deleteAccount(u.id, {
        confirm_username: typed().trim(),
        take_down_spaces: takeDown() && localSpaces().length > 0,
        delete_applications: deleteApps() && apps().length > 0,
      });
      props.onDeleted(result);
    } catch (err) {
      if (isApiError(err) && err.status === 409 && err.code === 'blocked') {
        // Something changed since the preview (a new space, a new application): back to the
        // review with what the server says now.
        // The choices made were about the old list, so they are asked for again.
        const b = err.body?.blockers as DeletionBlockers | undefined;
        if (b) setFreshBlockers(b);
        setTakeDown(false);
        setDeleteApps(false);
        setStep('review');
      }
      setError(translateAccountDeletionError(err, t).join(' ') || t('admin.users.delete.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.user}>
      {(u) => (
        <ResponsiveDialog
          size="md"
          zClass={zLayer.modalStacked}
          onClose={props.onClose}
          dismissible={!busy()}
          title={t(isBot() ? 'admin.users.delete.titleBot' : 'admin.users.delete.title', { name: nameOf(u()) })}
          description={formatHandle(u())}
          icon={isBot() ? 'fa-solid fa-robot' : 'fa-solid fa-user-xmark'}
          tone="danger"
        >
          <Show
            when={preview()}
            fallback={
              <Show
                when={previewRes.error}
                fallback={<p class="py-6 text-center text-sm text-muted-foreground"><i class="fa-solid fa-spinner fa-spin me-2" aria-hidden="true" />{t('admin.loading')}</p>}
              >
                <div class="space-y-3">
                  <p class="text-sm text-destructive">{translateAccountDeletionError(previewRes.error, t).join(' ')}</p>
                  <div class={appDialogActions}>
                    <Button type="button" variant="ghost" onClick={props.onClose}>{t('common.cancel')}</Button>
                    <Button type="button" variant="outline" onClick={() => void refetch()}>{t('admin.refresh')}</Button>
                  </div>
                </div>
              </Show>
            }
          >
            {(p) => (
              <Show
                when={!p().refusal}
                fallback={
                  <div class="space-y-4">
                    <p class={`${settingsGroupFrame} text-sm`}>{t(`admin.users.deleteRefused.${p().refusal}`)}</p>
                    <div class={appDialogActions}>
                      <Button type="button" variant="ghost" onClick={props.onClose}>{t('common.close')}</Button>
                    </div>
                  </div>
                }
              >
                <Show
                  when={step() === 'confirm'}
                  fallback={
                    <div class="space-y-4">
                      <p class="text-sm text-muted-foreground">{t('admin.users.delete.reviewIntro')}</p>

                      <Show when={isBot() && p().application}>
                        {(app) => (
                          <p class="text-sm">
                            <Show
                              when={!app().orphan}
                              fallback={<span class="text-muted-foreground">{t('admin.users.delete.orphanBot')}</span>}
                            >
                              <i class="fa-solid fa-cube me-1.5 text-xs text-muted-foreground" aria-hidden="true" />
                              {t('admin.users.delete.botApplication', { name: app().name ?? '', owner: nameOf(app().owner) })}
                            </Show>
                          </p>
                        )}
                      </Show>

                      <section class="space-y-1.5">
                        <div class={settingsSectionTitle}>{t('admin.users.delete.removed')}</div>
                        <ul class="space-y-1 text-sm">
                          <li class="flex items-center gap-2">
                            <i class="fa-solid fa-id-badge w-4 text-center text-xs text-muted-foreground" aria-hidden="true" />
                            {t(isBot() ? 'admin.users.delete.removedIdentityBot' : 'admin.users.delete.removedIdentity', { username: username() })}
                          </li>
                          <For each={countLines()}>
                            {(l) => (
                              <li class="flex items-center gap-2">
                                <i class={`fa-solid ${l.icon} w-4 text-center text-xs text-muted-foreground`} aria-hidden="true" />
                                {t(`admin.users.delete.count.${l.key}`, { count: l.count })}
                              </li>
                            )}
                          </For>
                        </ul>
                      </section>

                      <section class="space-y-1.5">
                        <div class={settingsSectionTitle}>{t('admin.users.delete.kept')}</div>
                        <p class="text-sm text-muted-foreground">{t('admin.users.delete.keptBody')}</p>
                      </section>

                      <Show when={props.banned}>
                        <p class="flex gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <i class="fa-solid fa-network-wired mt-0.5" aria-hidden="true" />
                          <span>{t('admin.users.delete.ipBanNote')}</span>
                        </p>
                      </Show>
                      <Show when={remoteInstances() > 0}>
                        <p class="flex gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                          <i class="fa-solid fa-globe mt-0.5" aria-hidden="true" />
                          <span>
                            {t('admin.users.delete.count.remoteInstances', { count: remoteInstances() })}{' '}
                            {t('admin.users.delete.federationNote')}
                          </span>
                        </p>
                      </Show>

                      <Show when={blockers().owned_spaces.length > 0 || apps().length > 0}>
                        <section class={`${settingsGroupFrame} space-y-3 border-destructive/40`}>
                          <div class="text-sm font-medium text-destructive">{t('admin.users.delete.blockersTitle')}</div>

                          <Show when={blockers().owned_spaces.length > 0}>
                            <div class="space-y-1.5">
                              <div class="text-xs font-medium text-muted-foreground">{t('admin.users.delete.ownedSpaces')}</div>
                              <ul class="space-y-1 text-sm">
                                <For each={blockers().owned_spaces}>
                                  {(sp) => (
                                    <li class="flex flex-wrap items-center gap-x-2">
                                      <Show
                                        when={!sp.hosted_on}
                                        fallback={<span class="font-medium">{sp.name}</span>}
                                      >
                                        <button
                                          type="button"
                                          class="font-medium text-primary hover:underline"
                                          onClick={() => {
                                            props.onClose();
                                            props.onOpenSpace(sp.id);
                                          }}
                                        >
                                          {sp.name}
                                        </button>
                                      </Show>
                                      <span class="text-xs text-muted-foreground">{t('admin.users.delete.members', { count: sp.member_count })}</span>
                                      <Show when={sp.hosted_on}>
                                        {(host) => (
                                          <span class="w-full text-xs text-destructive">
                                            {t('admin.users.delete.ownedSpaceRemote', { domain: host() })}
                                          </span>
                                        )}
                                      </Show>
                                    </li>
                                  )}
                                </For>
                              </ul>
                              <Show when={localSpaces().length > 0}>
                                <Checkbox
                                  checked={takeDown()}
                                  onChange={setTakeDown}
                                  label={t('admin.users.delete.takeDownSpaces', { count: localSpaces().length })}
                                  description={t('admin.users.delete.takeDownSpacesHint')}
                                />
                              </Show>
                            </div>
                          </Show>

                          <Show when={apps().length > 0}>
                            <div class="space-y-1.5">
                              <div class="text-xs font-medium text-muted-foreground">{t('admin.users.delete.ownedApps')}</div>
                              <ul class="space-y-1 text-sm">
                                <For each={apps()}>
                                  {(app) => (
                                    <li class="flex flex-wrap items-center gap-x-2">
                                      <span class="font-medium">{app.name}</span>
                                      <Show
                                        when={app.bot_username}
                                        fallback={<span class="text-xs text-muted-foreground">{t('admin.users.delete.appNoBot')}</span>}
                                      >
                                        {(bot) => (
                                          <span class="text-xs text-muted-foreground">
                                            {t('admin.users.delete.appBot', { username: bot(), count: app.bot_space_count ?? 0 })}
                                          </span>
                                        )}
                                      </Show>
                                    </li>
                                  )}
                                </For>
                              </ul>
                              <Checkbox
                                checked={deleteApps()}
                                onChange={setDeleteApps}
                                label={t('admin.users.delete.deleteApplications', { count: apps().length })}
                                description={t('admin.users.delete.deleteApplicationsHint')}
                              />
                            </div>
                          </Show>
                        </section>
                      </Show>

                      <Show when={error()}>
                        <p class="text-sm text-destructive">{error()}</p>
                      </Show>
                      <div class={appDialogActions}>
                        <Button type="button" variant="ghost" onClick={props.onClose}>{t('common.cancel')}</Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={!canContinue()}
                          onClick={() => {
                            setError('');
                            setStep('confirm');
                          }}
                        >
                          {t('admin.users.delete.continue')}
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <form onSubmit={submit} class="space-y-4">
                    <div class="space-y-1.5">
                      <p class="text-sm">
                        {t('admin.users.delete.confirmLabel')}{' '}
                        <code class="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-sm font-semibold" dir="ltr">{username()}</code>
                      </p>
                      <Input
                        value={typed()}
                        onInput={(e) => setTyped(e.currentTarget.value)}
                        disabled={busy()}
                        autocomplete="off"
                        spellcheck={false}
                        autocapitalize="off"
                        aria-label={t('admin.users.delete.confirmLabel')}
                        placeholder={username()}
                        dir="ltr"
                      />
                      <p class="text-xs text-muted-foreground">{t('admin.users.delete.confirmHint')}</p>
                    </div>
                    <Show when={error()}>
                      <p class="text-sm text-destructive">{error()}</p>
                    </Show>
                    <div class={appDialogActions}>
                      <Button type="button" variant="ghost" onClick={() => setStep('review')} disabled={busy()}>{t('common.back')}</Button>
                      <Button type="submit" variant="destructive" loading={busy()} disabled={!confirmed()}>
                        {t(isBot() ? 'admin.users.delete.confirmButtonBot' : 'admin.users.delete.confirmButton')}
                      </Button>
                    </div>
                  </form>
                </Show>
              </Show>
            )}
          </Show>
        </ResponsiveDialog>
      )}
    </Show>
  );
};
