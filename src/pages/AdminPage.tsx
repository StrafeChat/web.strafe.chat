import type { Component } from 'solid-js';
import { createResource, createSignal, For, Show } from 'solid-js';
import { A, Navigate, useNavigate } from '@solidjs/router';
import {
  banUser,
  getInstanceCapabilities,
  getInstanceStats,
  getReport,
  getSpaceDetail,
  getUserDetail,
  listAudit,
  listBans,
  listReports,
  resolveReport,
  searchUsers,
  takeDownSpace,
  unbanUser,
  type AdminSpace,
  type AdminUser,
  type ReportDetail,
  type ReportRow,
  type ReportStatus,
  type ResolveAction,
  type SpaceDetail,
  type UserDetail,
} from '../api/instance';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ResponsiveDialog } from '../components/ui/ResponsiveDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { confirmDialog } from '../stores/confirmDialog';
import { openUserSettings } from '../stores/userSettingsModal';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from '../components/settings/settingsChrome';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { formatDate, t } from '../i18n';

type Tab = 'overview' | 'users' | 'reports' | 'bans' | 'audit';

const DAY = 24 * 60 * 60;
/** Ban lengths. Matches the server's cap of a year. */
const DURATIONS = [
  { seconds: 0, key: 'admin.durations.forever' },
  { seconds: DAY, key: 'admin.durations.day' },
  { seconds: 7 * DAY, key: 'admin.durations.week' },
  { seconds: 30 * DAY, key: 'admin.durations.month' },
  { seconds: 365 * DAY, key: 'admin.durations.year' },
];

const chip =
  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const chipOn = 'bg-primary/20 text-foreground ring-1 ring-inset ring-primary/30';
const chipOff = 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground';

const when = (iso?: string) => (iso ? formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' }) || iso : '');
const tag = (u: AdminUser | null | undefined) => (u ? `${u.username}#${u.discriminator}` : t('common.unknown'));
const nameOf = (u: AdminUser | null | undefined) => u?.display_name || u?.username || t('common.unknown');

/**
 * The instance administrator's desk: find an account, see what it is doing here, keep it
 * off the instance; work the report queue; read what has been done. Its own page rather
 * than a settings tab because it is a place you go to do a job, with room for a list and
 * a detail side by side.
 */
const AdminPage: Component = () => (
  <ProtectedRoute>
    <AdminGate />
  </ProtectedRoute>
);

/** Ask the server, never the cached flag: a hard navigation here beats READY arriving. */
const AdminGate: Component = () => {
  const [caps] = createResource(() => getInstanceCapabilities().catch(() => ({ instance_admin: false })));
  return (
    <Show when={caps()} fallback={<div class="min-h-dvh" />}>
      {(c) => (
        <Show when={c().instance_admin} fallback={<Navigate href="/" />}>
          <Dashboard />
        </Show>
      )}
    </Show>
  );
};

const Dashboard: Component = () => {
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<Tab>('overview');
  // Cross-tab navigation: "open this user" from a report, "open this report" from a user.
  const [focusUser, setFocusUser] = createSignal<string | null>(null);
  const [focusReport, setFocusReport] = createSignal<string | null>(null);
  const [focusSpace, setFocusSpace] = createSignal<string | null>(null);

  const goUser = (id: string) => {
    setFocusUser(id);
    setTab('users');
  };
  const goReport = (id: string) => {
    setFocusReport(id);
    setTab('reports');
  };
  const goSpace = (id: string) => {
    setFocusSpace(id);
  };

  return (
    <div class="relative z-10 min-h-dvh bg-background text-foreground">
      <header class="border-b border-border/70 bg-card/60 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t('admin.back')}
            onClick={() => navigate('/')}
          >
            <i class="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg font-semibold leading-tight">{t('admin.title')}</h1>
            <p class="truncate text-xs text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
        </div>
        <div class="mx-auto max-w-6xl px-4 pb-3">
          <Tabs<Tab>
            size="sm"
            value={tab()}
            onChange={setTab}
            items={[
              { id: 'overview', label: t('admin.tabs.overview') },
              { id: 'users', label: t('admin.tabs.users') },
              { id: 'reports', label: t('admin.tabs.reports') },
              { id: 'bans', label: t('admin.tabs.bans') },
              { id: 'audit', label: t('admin.tabs.audit') },
            ]}
          />
        </div>
      </header>
      <main class="mx-auto max-w-6xl px-4 py-6">
        <Show when={tab() === 'overview'}>
          <Overview onOpenReports={() => setTab('reports')} onOpenBans={() => setTab('bans')} />
        </Show>
        <Show when={tab() === 'users'}>
          <Users focusUser={focusUser()} onOpenReport={goReport} onOpenSpace={goSpace} />
        </Show>
        <Show when={tab() === 'reports'}>
          <Reports focusReport={focusReport()} onOpenUser={goUser} onOpenSpace={goSpace} />
        </Show>
        <Show when={tab() === 'bans'}>
          <Bans onOpenUser={goUser} />
        </Show>
        <Show when={tab() === 'audit'}>
          <Audit onOpenUser={goUser} />
        </Show>
      </main>
      <SpaceDrawer spaceId={focusSpace()} onClose={() => setFocusSpace(null)} onOpenUser={goUser} onOpenReport={goReport} />
    </div>
  );
};

// ---- overview ---------------------------------------------------------------------------

const Overview: Component<{ onOpenReports: () => void; onOpenBans: () => void }> = (props) => {
  const [stats, { refetch }] = createResource(() => getInstanceStats());
  const stat = (label: string, value: string | number, onClick?: () => void) => (
    <button
      type="button"
      class={`${settingsRowShell} w-full flex-col items-start gap-1 text-start ${onClick ? '' : 'cursor-default'}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span class="text-2xl font-semibold text-foreground">{value}</span>
      <span class="text-xs text-muted-foreground">{label}</span>
    </button>
  );
  // -1 is the server saying "could not determine"; show a dash, never a wrong 0.
  const num = (v: number) => (v < 0 ? '\u2014' : v.toLocaleString());
  return (
    <div class="space-y-4">
      <Show when={stats()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
        {(s) => (
          <div class="space-y-3">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stat(t('admin.overview.accounts'), num(s().accounts))}
              {stat(t('admin.overview.online'), num(s().online))}
              {stat(t('admin.overview.spaces'), num(s().spaces))}
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {stat(t('admin.overview.openReports'), s().open_reports, props.onOpenReports)}
              {stat(t('admin.overview.bans'), s().bans, props.onOpenBans)}
              {stat(t('admin.overview.invites'), s().invites, () => openUserSettings('instance'))}
              {stat(t('admin.overview.registration'), s().invite_only ? t('admin.overview.inviteOnly') : t('admin.overview.open'))}
            </div>
          </div>
        )}
      </Show>
      <p class="text-xs text-muted-foreground">{t('admin.overview.hint')}</p>
      <Button variant="ghost" size="sm" onClick={() => void refetch()}>
        {t('admin.refresh')}
      </Button>
    </div>
  );
};

// ---- users ------------------------------------------------------------------------------

const Users: Component<{ focusUser: string | null; onOpenReport: (id: string) => void; onOpenSpace: (id: string) => void }> = (
  props,
) => {
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<AdminUser[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal('');
  const [selected, setSelected] = createSignal<string | null>(props.focusUser);

  async function search(e?: Event) {
    e?.preventDefault();
    const q = query().trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const r = await searchUsers(q);
      setResults(r);
      if (r.length === 1) setSelected(r[0].id);
    } catch {
      setSearchError(t('admin.users.searchFailed'));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-3">
        <form onSubmit={search} class="flex items-center gap-2">
          <SearchInput value={query()} onValueChange={setQuery} placeholder={t('admin.users.searchPlaceholder')} wrapperClass="flex-1" />
          <Button type="submit" size="sm" loading={searching()}>
            {t('admin.users.search')}
          </Button>
        </form>
        <p class="text-xs text-muted-foreground">{t('admin.users.searchHint')}</p>
        <Show when={searchError()}>
          <p class="text-sm text-destructive">{searchError()}</p>
        </Show>
        <div class="space-y-1.5">
          <For each={results()}>
            {(u) => (
              <button
                type="button"
                class={`${settingsRowShell} w-full text-start ${selected() === u.id ? 'ring-1 ring-primary/40' : ''}`}
                onClick={() => setSelected(u.id)}
              >
                <MessageAvatar name={nameOf(u)} avatar={u.avatar} class="size-9 text-sm" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">{nameOf(u)}</div>
                  <div class="truncate text-xs text-muted-foreground">
                    {tag(u)}
                    <Show when={u.email}> · {u.email}</Show>
                  </div>
                </div>
              </button>
            )}
          </For>
          <Show when={!searching() && query().trim() && results().length === 0 && !searchError()}>
            <p class="px-1 text-sm text-muted-foreground">{t('admin.users.noResults')}</p>
          </Show>
        </div>
      </div>
      <div>
        <Show when={selected()} fallback={<EmptyState icon="fa-user-magnifying-glass" title={t('admin.users.pickOne')} size="inline" />}>
          {(id) => <UserPanel userId={id()} onOpenReport={props.onOpenReport} onOpenSpace={props.onOpenSpace} />}
        </Show>
      </div>
    </div>
  );
};

const UserPanel: Component<{ userId: string; onOpenReport: (id: string) => void; onOpenSpace: (id: string) => void }> = (props) => {
  const [detail, { refetch }] = createResource(() => props.userId, (id) => getUserDetail(id));
  const [banOpen, setBanOpen] = createSignal(false);
  const [error, setError] = createSignal('');

  async function unban(d: UserDetail) {
    const ok = await confirmDialog({
      title: t('admin.users.unbanTitle', { name: nameOf(d.user) }),
      body: t('admin.users.unbanBody'),
      confirmLabel: t('admin.users.unban'),
    });
    if (!ok) return;
    try {
      await unbanUser(d.user.id);
      await refetch();
    } catch {
      setError(t('admin.actionFailed'));
    }
  }

  return (
    <Show when={detail()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
      {(d) => (
        <div class="space-y-4">
          <div class={`${settingsGroupFrame} flex items-start gap-4`}>
            <MessageAvatar name={nameOf(d().user)} avatar={d().user.avatar} class="size-14 text-lg" />
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold">{nameOf(d().user)}</span>
                <span class="text-sm text-muted-foreground">{tag(d().user)}</span>
                <Show when={d().instance_admin}>
                  <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">{t('admin.users.adminBadge')}</span>
                </Show>
                <Show when={d().user.home_domain}>
                  <span class="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t('admin.users.remote', { domain: d().user.home_domain ?? '' })}
                  </span>
                </Show>
                <Show when={d().ban}>
                  <span class="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">{t('admin.users.bannedBadge')}</span>
                </Show>
              </div>
              <dl class="grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                <div><dt class="inline font-medium text-foreground/80">{t('admin.users.id')}: </dt><dd class="inline font-mono">{d().user.id}</dd></div>
                <div><dt class="inline font-medium text-foreground/80">{t('admin.users.email')}: </dt><dd class="inline">{d().user.email || '—'}</dd></div>
                <div><dt class="inline font-medium text-foreground/80">{t('admin.users.created')}: </dt><dd class="inline">{when(d().user.created_at) || '—'}</dd></div>
              </dl>
            </div>
          </div>

          <Show when={d().ban} fallback={
            <Show when={!d().user.home_domain}>
              <Button variant="destructive" size="sm" onClick={() => setBanOpen(true)}>
                <i class="fa-solid fa-ban text-xs" aria-hidden="true" /> {t('admin.users.ban')}
              </Button>
            </Show>
          }>
            {(b) => (
              <div class={`${settingsGroupFrame} space-y-2 border-destructive/40`}>
                <div class="text-sm font-medium text-destructive">{t('admin.users.bannedTitle')}</div>
                <div class="text-sm">{b().reason || t('admin.users.noReason')}</div>
                <div class="text-xs text-muted-foreground">
                  {t('admin.users.bannedSince', { when: when(b().created_at) })} ·{' '}
                  {b().expires_at ? t('admin.users.bannedUntil', { when: when(b().expires_at) }) : t('admin.users.bannedForever')}
                </div>
                <Button variant="outline" size="sm" onClick={() => void unban(d())}>
                  {t('admin.users.unban')}
                </Button>
              </div>
            )}
          </Show>
          <Show when={error()}>
            <p class="text-sm text-destructive">{error()}</p>
          </Show>

          <section class="space-y-2">
            <div class={settingsSectionTitle}>{t('admin.users.sessions', { count: d().sessions.length })}</div>
            <Show when={d().sessions.length > 0} fallback={<p class="text-sm text-muted-foreground">{t('admin.users.noSessions')}</p>}>
              <div class="space-y-1.5">
                <For each={d().sessions}>
                  {(s) => (
                    <div class={settingsRowShell}>
                      <div class={settingsRowIcon}><i class="fa-solid fa-laptop" aria-hidden="true" /></div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm">{s.user_agent || t('common.unknown')}</div>
                        <div class="truncate text-xs text-muted-foreground">{s.ip_address} · {when(s.created_at)}</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="space-y-2">
            <div class={settingsSectionTitle}>{t('admin.users.spaces', { count: d().spaces.length })}</div>
            <Show when={d().spaces.length > 0} fallback={<p class="text-sm text-muted-foreground">{t('admin.users.noSpaces')}</p>}>
              <div class="flex flex-wrap gap-1.5">
                <For each={d().spaces}>
                  {(sp) => (
                    <button type="button" class={`${chip} ${chipOff}`} onClick={() => props.onOpenSpace(sp.id)}>
                      {sp.name}
                      <Show when={sp.owner_id === d().user.id}> · {t('admin.space.ownerShort')}</Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="space-y-2">
            <div class={settingsSectionTitle}>{t('admin.users.reportsAgainst', { count: d().reports.length })}</div>
            <Show when={d().reports.length > 0} fallback={<p class="text-sm text-muted-foreground">{t('admin.users.noReports')}</p>}>
              <div class="space-y-1.5">
                <For each={d().reports}>
                  {(r) => (
                    <button type="button" class={`${settingsRowShell} w-full text-start`} onClick={() => props.onOpenReport(r.id)}>
                      <div class={settingsRowIcon}><i class="fa-solid fa-flag" aria-hidden="true" /></div>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm">{t(`report.reasons.${r.reason}`)}</div>
                        <div class="text-xs text-muted-foreground">{t(`admin.reports.status.${r.status}`)} · {when(r.created_at)}</div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <BanDialog
            user={banOpen() ? d().user : null}
            onClose={() => setBanOpen(false)}
            onBanned={() => {
              setBanOpen(false);
              void refetch();
            }}
          />
        </div>
      )}
    </Show>
  );
};

const BanDialog: Component<{ user: AdminUser | null; onClose: () => void; onBanned: () => void }> = (props) => {
  const [reason, setReason] = createSignal('');
  const [seconds, setSeconds] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function submit(e: Event) {
    e.preventDefault();
    const u = props.user;
    if (!u) return;
    setBusy(true);
    setError('');
    try {
      await banUser(u.id, { reason: reason().trim(), max_age_seconds: seconds() });
      setReason('');
      props.onBanned();
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.user}>
      {(u) => (
        <ResponsiveDialog
          size="sm"
          zClass={zLayer.modalStacked}
          onClose={props.onClose}
          dismissible={!busy()}
          title={t('admin.users.banTitle', { name: nameOf(u()) })}
          description={t('admin.users.banBody')}
          icon="fa-solid fa-ban"
          tone="danger"
        >
          <form onSubmit={submit} class="space-y-4">
            <Textarea
              label={t('admin.users.banReason')}
              placeholder={t('admin.users.banReasonPlaceholder')}
              value={reason()}
              onInput={(e) => setReason(e.currentTarget.value)}
              maxlength={500}
              disabled={busy()}
            />
            <div class="space-y-1.5">
              <div class="text-xs font-medium text-muted-foreground">{t('admin.users.banDuration')}</div>
              <div class="flex flex-wrap gap-1.5">
                <For each={DURATIONS}>
                  {(d) => (
                    <button type="button" class={`${chip} ${seconds() === d.seconds ? chipOn : chipOff}`} aria-pressed={seconds() === d.seconds} onClick={() => setSeconds(d.seconds)}>
                      {t(d.key)}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <Show when={error()}>
              <p class="text-sm text-destructive">{error()}</p>
            </Show>
            <div class={appDialogActions}>
              <Button type="button" variant="ghost" onClick={props.onClose} disabled={busy()}>{t('common.cancel')}</Button>
              <Button type="submit" variant="destructive" loading={busy()}>{t('admin.users.confirmBan')}</Button>
            </div>
          </form>
        </ResponsiveDialog>
      )}
    </Show>
  );
};

// ---- reports ----------------------------------------------------------------------------

const Reports: Component<{ focusReport: string | null; onOpenUser: (id: string) => void; onOpenSpace: (id: string) => void }> = (props) => {
  const [status, setStatus] = createSignal<ReportStatus>('open');
  const [rows, { refetch }] = createResource(status, (s) => listReports(s));
  const [selected, setSelected] = createSignal<string | null>(props.focusReport);

  const targetLabel = (r: ReportRow) =>
    r.report.target_type === 'user' ? nameOf(r.target_user) : r.target_space?.name || t('admin.space.gone');

  return (
    <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-3">
        <Tabs<ReportStatus>
          size="sm"
          value={status()}
          onChange={(s) => { setStatus(s); setSelected(null); }}
          items={[
            { id: 'open', label: t('admin.reports.status.open') },
            { id: 'resolved', label: t('admin.reports.status.resolved') },
            { id: 'dismissed', label: t('admin.reports.status.dismissed') },
          ]}
        />
        <Show when={rows()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
          {(list) => (
            <Show when={list().length > 0} fallback={<EmptyState icon="fa-flag" title={t('admin.reports.empty')} size="inline" />}>
              <div class="space-y-1.5">
                <For each={list()}>
                  {(r) => (
                    <button
                      type="button"
                      class={`${settingsRowShell} w-full text-start ${selected() === r.report.id ? 'ring-1 ring-primary/40' : ''}`}
                      onClick={() => setSelected(r.report.id)}
                    >
                      <div class={settingsRowIcon}>
                        <i class={`fa-solid ${r.report.target_type === 'space' ? 'fa-layer-group' : 'fa-user'}`} aria-hidden="true" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-sm font-medium">
                          {t(`report.reasons.${r.report.reason}`)} · {targetLabel(r)}
                        </div>
                        <div class="truncate text-xs text-muted-foreground">
                          {t('admin.reports.by', { name: nameOf(r.reporter) })} · {when(r.report.created_at)}
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          )}
        </Show>
      </div>
      <div>
        <Show when={selected()} fallback={<EmptyState icon="fa-flag" title={t('admin.reports.pickOne')} size="inline" />}>
          {(id) => (
            <ReportPanel
              reportId={id()}
              onOpenUser={props.onOpenUser}
              onOpenSpace={props.onOpenSpace}
              onChanged={() => { setSelected(null); void refetch(); }}
            />
          )}
        </Show>
      </div>
    </div>
  );
};

const ReportPanel: Component<{ reportId: string; onOpenUser: (id: string) => void; onOpenSpace: (id: string) => void; onChanged: () => void }> = (props) => {
  const [detail] = createResource(() => props.reportId, (id) => getReport(id));
  const [note, setNote] = createSignal('');
  const [seconds, setSeconds] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function act(d: ReportDetail, action: ResolveAction) {
    if (action === 'ban_user' || action === 'remove_space') {
      const ok = await confirmDialog({
        title: action === 'ban_user' ? t('admin.reports.confirmBanTitle') : t('admin.reports.confirmRemoveTitle'),
        body: action === 'ban_user' ? t('admin.reports.confirmBanBody', { name: nameOf(d.target_user) }) : t('admin.reports.confirmRemoveBody', { name: d.target_space?.name ?? '' }),
        confirmLabel: action === 'ban_user' ? t('admin.reports.banUser') : t('admin.reports.removeSpace'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    try {
      await resolveReport(d.report.id, { action, note: note().trim(), max_age_seconds: seconds() });
      props.onChanged();
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={detail()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
      {(d) => (
        <div class="space-y-4">
          <div class={`${settingsGroupFrame} space-y-3`}>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">{t(`report.reasons.${d().report.reason}`)}</span>
              <span class="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{t(`admin.reports.status.${d().report.status}`)}</span>
              <span class="text-xs text-muted-foreground">{when(d().report.created_at)}</span>
            </div>
            <dl class="space-y-1.5 text-sm">
              <div class="flex flex-wrap items-center gap-1.5">
                <dt class="text-muted-foreground">{t('admin.reports.reporter')}:</dt>
                <dd>
                  <button type="button" class="text-primary hover:underline" onClick={() => d().reporter && props.onOpenUser(d().reporter!.id)}>
                    {nameOf(d().reporter)} <span class="text-muted-foreground">{tag(d().reporter)}</span>
                  </button>
                </dd>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <dt class="text-muted-foreground">{t('admin.reports.target')}:</dt>
                <dd>
                  <Show
                    when={d().report.target_type === 'user'}
                    fallback={
                      <button type="button" class="text-primary hover:underline" onClick={() => props.onOpenSpace(d().report.target_id)}>
                        {d().target_space?.name ?? t('admin.space.gone')}
                      </button>
                    }
                  >
                    <button type="button" class="text-primary hover:underline" onClick={() => props.onOpenUser(d().report.target_id)}>
                      {nameOf(d().target_user)} <span class="text-muted-foreground">{tag(d().target_user)}</span>
                    </button>
                  </Show>
                </dd>
              </div>
            </dl>
            <div>
              <div class="text-xs font-medium text-muted-foreground">{t('admin.reports.details')}</div>
              <p class="whitespace-pre-wrap text-sm">{d().report.details || <span class="text-muted-foreground">{t('admin.reports.noDetails')}</span>}</p>
            </div>
            <Show when={d().message}>
              {(m) => (
                <div class="rounded-lg border border-border/70 bg-background/40 p-3">
                  <div class="mb-1 text-xs font-medium text-muted-foreground">
                    {t('admin.reports.message', { room: d().room?.name || t('common.unknown') })}
                  </div>
                  <Show
                    when={m().readable}
                    fallback={
                      <p class="text-sm italic text-muted-foreground">
                        {m().deleted ? t('admin.reports.messageDeleted') : t('admin.reports.messageEncrypted')}
                      </p>
                    }
                  >
                    <p class="whitespace-pre-wrap text-sm">{m().text}</p>
                  </Show>
                </div>
              )}
            </Show>
            <Show when={d().report.status !== 'open'}>
              <div class="text-xs text-muted-foreground">
                {t('admin.reports.resolvedLine', {
                  outcome: t(`admin.reports.resolution.${d().report.resolution ?? 'none'}`),
                  when: when(d().report.resolved_at),
                })}
                <Show when={d().report.resolution_note}> · {d().report.resolution_note}</Show>
              </div>
            </Show>
          </div>

          <Show when={d().report.status === 'open'}>
            <div class={`${settingsGroupFrame} space-y-3`}>
              <div class={settingsSectionTitle}>{t('admin.reports.actions')}</div>
              <Textarea
                label={t('admin.reports.note')}
                placeholder={t('admin.reports.notePlaceholder')}
                value={note()}
                onInput={(e) => setNote(e.currentTarget.value)}
                maxlength={500}
                disabled={busy()}
              />
              <Show when={d().report.target_type === 'user'}>
                <div class="space-y-1.5">
                  <div class="text-xs font-medium text-muted-foreground">{t('admin.users.banDuration')}</div>
                  <div class="flex flex-wrap gap-1.5">
                    <For each={DURATIONS}>
                      {(x) => (
                        <button type="button" class={`${chip} ${seconds() === x.seconds ? chipOn : chipOff}`} aria-pressed={seconds() === x.seconds} onClick={() => setSeconds(x.seconds)}>
                          {t(x.key)}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
              <Show when={error()}>
                <p class="text-sm text-destructive">{error()}</p>
              </Show>
              <div class="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" disabled={busy()} onClick={() => void act(d(), 'dismiss')}>{t('admin.reports.dismiss')}</Button>
                <Button variant="secondary" size="sm" disabled={busy()} onClick={() => void act(d(), 'resolve')}>{t('admin.reports.resolve')}</Button>
                <Show when={d().report.target_type === 'user'}>
                  <Button variant="destructive" size="sm" disabled={busy()} onClick={() => void act(d(), 'ban_user')}>{t('admin.reports.banUser')}</Button>
                </Show>
                <Show when={d().report.target_type === 'space'}>
                  <Button variant="destructive" size="sm" disabled={busy()} onClick={() => void act(d(), 'remove_space')}>{t('admin.reports.removeSpace')}</Button>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

// ---- bans / audit -----------------------------------------------------------------------

const Bans: Component<{ onOpenUser: (id: string) => void }> = (props) => {
  const [rows, { refetch }] = createResource(() => listBans());
  async function lift(userId: string, name: string) {
    const ok = await confirmDialog({ title: t('admin.users.unbanTitle', { name }), body: t('admin.users.unbanBody'), confirmLabel: t('admin.users.unban') });
    if (!ok) return;
    await unbanUser(userId).catch(() => undefined);
    void refetch();
  }
  return (
    <Show when={rows()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
      {(list) => (
        <Show when={list().length > 0} fallback={<EmptyState icon="fa-ban" title={t('admin.bans.empty')} size="inline" />}>
          <div class="space-y-1.5">
            <For each={list()}>
              {(row) => (
                <div class={settingsRowShell}>
                  <MessageAvatar name={nameOf(row.user)} avatar={row.user?.avatar} class="size-9 text-sm" />
                  <div class="min-w-0 flex-1">
                    <button type="button" class="truncate text-sm font-medium hover:underline" onClick={() => props.onOpenUser(row.ban.user_id)}>
                      {nameOf(row.user)} <span class="font-normal text-muted-foreground">{tag(row.user)}</span>
                    </button>
                    <div class="truncate text-xs text-muted-foreground">
                      {row.ban.reason || t('admin.users.noReason')} · {row.ban.expires_at ? t('admin.users.bannedUntil', { when: when(row.ban.expires_at) }) : t('admin.users.bannedForever')}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void lift(row.ban.user_id, nameOf(row.user))}>{t('admin.users.unban')}</Button>
                </div>
              )}
            </For>
          </div>
        </Show>
      )}
    </Show>
  );
};

const AUDIT_ICON: Record<string, string> = {
  user_ban: 'fa-ban',
  user_unban: 'fa-user-check',
  space_takedown: 'fa-trash',
  report_resolve: 'fa-check',
  report_dismiss: 'fa-xmark',
  invite_create: 'fa-ticket',
  invite_revoke: 'fa-ticket',
};

const Audit: Component<{ onOpenUser: (id: string) => void }> = (props) => {
  const [rows] = createResource(() => listAudit());
  return (
    <Show when={rows()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
      {(list) => (
        <Show when={list().length > 0} fallback={<EmptyState icon="fa-clock-rotate-left" title={t('admin.audit.empty')} size="inline" />}>
          <div class="space-y-1.5">
            <For each={list()}>
              {(row) => (
                <div class={settingsRowShell}>
                  <div class={settingsRowIcon}><i class={`fa-solid ${AUDIT_ICON[row.entry.action] ?? 'fa-circle-info'}`} aria-hidden="true" /></div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm">
                      <button type="button" class="font-medium hover:underline" onClick={() => props.onOpenUser(row.entry.actor_id)}>{nameOf(row.actor)}</button>{' '}
                      {t(`admin.audit.actions.${row.entry.action}`, { defaultValue: row.entry.action })}
                      <Show when={row.entry.target_type === 'user' && row.entry.target_id !== '0'}>
                        {' '}<button type="button" class="font-mono text-xs text-primary hover:underline" onClick={() => props.onOpenUser(row.entry.target_id)}>{row.entry.target_id}</button>
                      </Show>
                      <Show when={row.entry.target_type !== 'user' && row.entry.reason}> · <span class="font-mono text-xs">{row.entry.reason}</span></Show>
                    </div>
                    <div class="truncate text-xs text-muted-foreground">
                      {when(row.entry.created_at)}
                      <Show when={row.entry.target_type === 'user' && row.entry.reason}> · {row.entry.reason}</Show>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      )}
    </Show>
  );
};

// ---- space drawer -----------------------------------------------------------------------

const SpaceDrawer: Component<{ spaceId: string | null; onClose: () => void; onOpenUser: (id: string) => void; onOpenReport: (id: string) => void }> = (props) => {
  const [detail] = createResource(() => props.spaceId, (id) => (id ? getSpaceDetail(id) : null));
  const [reason, setReason] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function takeDown(d: SpaceDetail) {
    const ok = await confirmDialog({
      title: t('admin.space.takeDownTitle', { name: d.space.name }),
      body: t('admin.space.takeDownBody'),
      confirmLabel: t('admin.space.takeDown'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await takeDownSpace(d.space.id, reason().trim());
      props.onClose();
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={props.spaceId}>
      <ResponsiveDialog size="md" zClass={zLayer.modalStacked} onClose={props.onClose} dismissible={!busy()} title={detail()?.space.name ?? '…'} icon="fa-solid fa-layer-group">
        <Show when={detail()} fallback={<p class="text-sm text-muted-foreground">…</p>}>
          {(d) => (
            <div class="space-y-4">
              <dl class="space-y-1 text-sm">
                <div class="flex gap-1.5"><dt class="text-muted-foreground">{t('admin.space.owner')}:</dt><dd><button type="button" class="text-primary hover:underline" onClick={() => { props.onClose(); props.onOpenUser(d().space.owner_id); }}>{nameOf(d().owner)}</button></dd></div>
                <div class="flex gap-1.5"><dt class="text-muted-foreground">{t('admin.space.members')}:</dt><dd>{d().member_count}</dd></div>
                <div class="flex gap-1.5"><dt class="text-muted-foreground">{t('admin.users.created')}:</dt><dd>{when(d().space.created_at)}</dd></div>
                <div class="flex gap-1.5"><dt class="text-muted-foreground">{t('admin.users.id')}:</dt><dd class="font-mono">{d().space.id}</dd></div>
              </dl>
              <Show when={d().reports.length > 0}>
                <div class="space-y-1.5">
                  <div class={settingsSectionTitle}>{t('admin.users.reportsAgainst', { count: d().reports.length })}</div>
                  <For each={d().reports}>
                    {(r) => (
                      <button type="button" class={`${settingsRowShell} w-full text-start`} onClick={() => { props.onClose(); props.onOpenReport(r.id); }}>
                        <div class="min-w-0 flex-1">
                          <div class="text-sm">{t(`report.reasons.${r.reason}`)}</div>
                          <div class="text-xs text-muted-foreground">{t(`admin.reports.status.${r.status}`)} · {when(r.created_at)}</div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
              <div class={`${settingsGroupFrame} space-y-3 border-destructive/40`}>
                <div class="text-sm font-medium text-destructive">{t('admin.space.takeDown')}</div>
                <p class="text-xs text-muted-foreground">{t('admin.space.takeDownHint')}</p>
                <Textarea label={t('admin.space.takeDownReason')} value={reason()} onInput={(e) => setReason(e.currentTarget.value)} maxlength={500} disabled={busy()} />
                <Show when={error()}><p class="text-sm text-destructive">{error()}</p></Show>
                <Button variant="destructive" size="sm" loading={busy()} onClick={() => void takeDown(d())}>{t('admin.space.takeDown')}</Button>
              </div>
            </div>
          )}
        </Show>
      </ResponsiveDialog>
    </Show>
  );
};

// Keep the type import "used" for readers of this file; A is used in the header link.
export type { AdminSpace };
void A;

export default AdminPage;
