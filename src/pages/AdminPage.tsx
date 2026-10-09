import type { Component } from 'solid-js';
import { formatHandle } from '../stores/instance';
import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { A, Navigate, useNavigate } from '@solidjs/router';
import { BADGES } from '../lib/badges';
import {
  banIP,
  banUser,
  getInstanceCapabilities,
  getInstanceStats,
  getReport,
  getSpaceDetail,
  getUserDetail,
  listAudit,
  listBans,
  listIPBans,
  listReports,
  resolveReport,
  searchUsers,
  takeDownSpace,
  unbanIP,
  unbanUser,
  type AdminSpace,
  type AdminUser,
  type ReportDetail,
  type ReportRow,
  type ReportStatus,
  type InstanceStats,
  type ResolveAction,
  type SpaceDetail,
  type UserDetail,
  setUserBadges,
  setUserEmail,
  sendUserNotice,
  regenerateUserRecoveryCodes,
  type RecoveryCodesResult,
  setSpaceOfficial,
  listFederationPolicy,
  setFederationPolicy,
  removeFederationPolicy,
  type PeerPolicyRow,
} from '../api/instance';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { DiscoverQueue } from '../components/admin/DiscoverQueue';
import { AdminTabs, AdminFilterTabs } from '../components/admin/AdminTabs';
import {
  AdminLoadingScreen,
  AdminOverviewSkeleton,
  AdminListSkeleton,
  AdminDetailSkeleton,
} from '../components/admin/AdminLoading';
import type { AdminTabItem } from '../components/admin/AdminTabs';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Input } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { EmptyState } from '../components/ui/EmptyState';
import { ResponsiveDialog } from '../components/ui/ResponsiveDialog';
import { SearchInput } from '../components/ui/SearchInput';
import { Textarea } from '../components/ui/Textarea';
import { MessageAvatar } from '../components/messageList/MessageAvatar';
import { confirmDialog } from '../stores/confirmDialog';
import { openUserSettings } from '../stores/userSettingsModal';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from '../components/settings/settingsChrome';
import { appDialogActions, zLayer } from '../theme/appChrome';
import { translateCaughtApiError } from '../lib/formatApiError';
import { formatDate, t } from '../i18n';

type Tab = 'overview' | 'users' | 'reports' | 'bans' | 'discover' | 'audit' | 'federation';

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
const tag = (u: AdminUser | null | undefined) => (u ? formatHandle(u) : t('common.unknown'));
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
    <Show when={caps()} fallback={<AdminLoadingScreen />}>
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
  // Stats live here rather than in Overview so the tab bar can badge open reports and bans,
  // and so returning to Overview does not refetch what the header already has.
  const [stats, { refetch: refetchStats }] = createResource(() => getInstanceStats().catch(() => null));
  const statCount = (v?: number) => (v != null && v > 0 ? v : undefined);

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

  const tabs = createMemo<AdminTabItem<Tab>[]>(() => [
    { id: 'overview', icon: 'fa-gauge-high', label: t('admin.tabs.overview') },
    { id: 'users', icon: 'fa-users', label: t('admin.tabs.users') },
    { id: 'reports', icon: 'fa-flag', label: t('admin.tabs.reports'), count: statCount(stats()?.open_reports) },
    { id: 'bans', icon: 'fa-ban', label: t('admin.tabs.bans'), count: statCount(stats()?.bans) },
    { id: 'discover', icon: 'fa-compass', label: t('admin.tabs.discover') },
    { id: 'audit', icon: 'fa-clock-rotate-left', label: t('admin.tabs.audit') },
    { id: 'federation', icon: 'fa-globe', label: t('admin.federation.tab') },
  ]);

  return (
    <div class="relative z-10 min-h-dvh bg-background text-foreground" data-admin-page>
      <header class="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div
          class="pointer-events-none absolute inset-x-0 -top-24 h-40 opacity-60"
          style={{
            'background-image': 'radial-gradient(60% 100% at 50% 100%, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div class="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t('admin.back')}
            onClick={() => navigate('/')}
          >
            <i class="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <i class="fa-solid fa-shield-halved text-lg" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg font-semibold leading-tight">{t('admin.title')}</h1>
            <p class="truncate text-xs text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
        </div>
        <div class="relative mx-auto max-w-6xl px-4 pb-3">
          <AdminTabs<Tab> value={tab()} onChange={setTab} items={tabs()} />
        </div>
      </header>
      <main class="mx-auto max-w-6xl px-4 py-6">
        <Show when={tab() === 'overview'}>
          <div class="admin-panel-in">
            <Overview stats={stats()} onRefresh={() => void refetchStats()} onOpenReports={() => setTab('reports')} onOpenBans={() => setTab('bans')} />
          </div>
        </Show>
        <Show when={tab() === 'users'}>
          <div class="admin-panel-in">
            <Users focusUser={focusUser()} onOpenReport={goReport} onOpenSpace={goSpace} />
          </div>
        </Show>
        <Show when={tab() === 'reports'}>
          <div class="admin-panel-in">
            <Reports focusReport={focusReport()} onOpenUser={goUser} onOpenSpace={goSpace} />
          </div>
        </Show>
        <Show when={tab() === 'bans'}>
          <div class="admin-panel-in">
            <Bans onOpenUser={goUser} />
          </div>
        </Show>
        <Show when={tab() === 'discover'}>
          <div class="admin-panel-in">
            <DiscoverQueue onOpenUser={goUser} onOpenSpace={goSpace} />
          </div>
        </Show>
        <Show when={tab() === 'audit'}>
          <div class="admin-panel-in">
            <Audit onOpenUser={goUser} />
          </div>
        </Show>
        <Show when={tab() === 'federation'}>
          <div class="admin-panel-in">
            <FederationPanel />
          </div>
        </Show>
      </main>
      <SpaceDrawer spaceId={focusSpace()} onClose={() => setFocusSpace(null)} onOpenUser={goUser} onOpenReport={goReport} />
    </div>
  );
};

// ---- overview ---------------------------------------------------------------------------

type StatTone = 'green' | 'blue' | 'violet' | 'amber' | 'red' | 'sky';

const STAT_TONE: Record<StatTone, { chip: string; accent: string }> = {
  green: { chip: 'bg-primary/15 text-primary', accent: 'from-primary/25' },
  blue: { chip: 'bg-blue-500/15 text-blue-400', accent: 'from-blue-500/25' },
  violet: { chip: 'bg-violet-500/15 text-violet-400', accent: 'from-violet-500/25' },
  amber: { chip: 'bg-amber-500/15 text-amber-400', accent: 'from-amber-500/25' },
  red: { chip: 'bg-destructive/15 text-destructive', accent: 'from-destructive/25' },
  sky: { chip: 'bg-sky-500/15 text-sky-400', accent: 'from-sky-500/25' },
};

const Overview: Component<{
  stats: InstanceStats | null | undefined;
  onRefresh: () => void;
  onOpenReports: () => void;
  onOpenBans: () => void;
}> = (props) => {
  const stat = (opts: { label: string; value: string | number; icon: string; tone: StatTone; onClick?: () => void }) => {
    const t0 = STAT_TONE[opts.tone];
    return (
      <button
        type="button"
        class={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card/40 px-4 py-4 text-start transition-all duration-200 ${
          opts.onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-border hover:bg-card/70 hover:shadow-lg hover:shadow-black/20' : 'cursor-default'
        }`}
        onClick={opts.onClick}
        disabled={!opts.onClick}
      >
        <span
          class={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${t0.accent} to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
          aria-hidden="true"
        />
        <span class={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg ${t0.chip}`}>
          <i class={`fa-solid ${opts.icon}`} aria-hidden="true" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-2xl font-semibold leading-tight tabular-nums">{opts.value}</span>
          <span class="block truncate text-xs text-muted-foreground">{opts.label}</span>
        </span>
        <Show when={opts.onClick}>
          <i
            class="fa-solid fa-arrow-right shrink-0 text-xs text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1"
            aria-hidden="true"
          />
        </Show>
      </button>
    );
  };
  // -1 is the server saying "could not determine"; show a dash, never a wrong 0.
  const num = (v: number) => (v < 0 ? '\u2014' : v.toLocaleString());
  const s = () => props.stats;
  return (
    <div class="space-y-5">
      <Show when={s()} fallback={<AdminOverviewSkeleton />}>
        {(st) => (
          <div class="space-y-4">
            <div>
              <div class={settingsSectionTitle}>{t('admin.overview.activity')}</div>
              <div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stat({ label: t('admin.overview.accounts'), value: num(st().accounts), icon: 'fa-users', tone: 'green' })}
                {stat({ label: t('admin.overview.online'), value: num(st().online), icon: 'fa-signal', tone: 'sky' })}
                {stat({ label: t('admin.overview.spaces'), value: num(st().spaces), icon: 'fa-layer-group', tone: 'blue' })}
              </div>
            </div>
            <div>
              <div class={settingsSectionTitle}>{t('admin.overview.moderation')}</div>
              <div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stat({ label: t('admin.overview.openReports'), value: st().open_reports, icon: 'fa-flag', tone: 'amber', onClick: props.onOpenReports })}
                {stat({ label: t('admin.overview.bans'), value: st().bans, icon: 'fa-ban', tone: 'red', onClick: props.onOpenBans })}
                {stat({ label: t('admin.overview.ipBans'), value: st().ip_bans ?? 0, icon: 'fa-network-wired', tone: 'red', onClick: props.onOpenBans })}
              </div>
            </div>
            <div>
              <div class={settingsSectionTitle}>{t('admin.overview.instance')}</div>
              <div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stat({ label: t('admin.overview.invites'), value: st().invites, icon: 'fa-ticket', tone: 'violet', onClick: () => openUserSettings('instance') })}
                {stat({
                  label: t('admin.overview.registration'),
                  value: st().invite_only ? t('admin.overview.inviteOnly') : t('admin.overview.open'),
                  icon: st().invite_only ? 'fa-lock' : 'fa-door-open',
                  tone: 'violet',
                  onClick: () => openUserSettings('instance'),
                })}
              </div>
            </div>
          </div>
        )}
      </Show>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={props.onRefresh}>
          <i class="fa-solid fa-rotate text-xs" aria-hidden="true" /> {t('admin.refresh')}
        </Button>
        <p class="text-xs text-muted-foreground">{t('admin.overview.hint')}</p>
      </div>
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
  // Follow the prop, not just seed from it: this panel is mounted under a plain <Show> on
  // the tab, so "open user" from a report while already on the Users tab changes
  // focusUser without remounting - and the one-shot seed above left the old user selected.
  createEffect(() => {
    const id = props.focusUser;
    if (id) setSelected(id);
  });

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
        <div class={`${settingsGroupFrame} space-y-3`}>
          <form onSubmit={search} class="flex items-center gap-2">
            <SearchInput value={query()} onValueChange={setQuery} placeholder={t('admin.users.searchPlaceholder')} wrapperClass="flex-1" />
            <Button type="submit" size="sm" loading={searching()}>
              <i class="fa-solid fa-magnifying-glass text-xs" aria-hidden="true" /> {t('admin.users.search')}
            </Button>
          </form>
          <p class="text-xs text-muted-foreground">{t('admin.users.searchHint')}</p>
        </div>
        <Show when={searchError()}>
          <p class="text-sm text-destructive">{searchError()}</p>
        </Show>
        <Show when={results().length > 0}>
          <div class={settingsSectionTitle}>{t('admin.users.results', { count: results().length })}</div>
        </Show>
        <div class="space-y-1.5">
          <For each={results()}>
            {(u, i) => (
              <button
                type="button"
                style={{ 'animation-delay': `${Math.min(i() * 30, 300)}ms` }}
                class={`admin-row-in ${settingsRowShell} w-full text-start ${
                  selected() === u.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''
                }`}
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
                <Show when={selected() === u.id}>
                  <i class="fa-solid fa-chevron-right shrink-0 text-xs text-primary" aria-hidden="true" />
                </Show>
              </button>
            )}
          </For>
          <Show when={!searching() && query().trim() && results().length === 0 && !searchError()}>
            <EmptyState icon="fa-user-slash" title={t('admin.users.noResults')} size="inline" />
          </Show>
        </div>
      </div>
      <div>
        <Show when={selected()} fallback={<EmptyState icon="fa-users-viewfinder" title={t('admin.users.pickOne')} size="inline" />}>
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
  // Badge flags, edited optimistically and saved on each toggle. `null` until a detail
  // loads (or right after a switch to a new user), when it seeds from the server.
  const [badgeFlags, setBadgeFlags] = createSignal<number | null>(null);
  const [badgeSaving, setBadgeSaving] = createSignal(false);
  const [recoveryResult, setRecoveryResult] = createSignal<RecoveryCodesResult | null>(null);
  const [recoveryBusy, setRecoveryBusy] = createSignal(false);
  const [emailOpen, setEmailOpen] = createSignal(false);
  const [noticeText, setNoticeText] = createSignal('');
  const [noticeBusy, setNoticeBusy] = createSignal(false);
  const [noticeError, setNoticeError] = createSignal('');
  const [noticeSent, setNoticeSent] = createSignal(false);

  createEffect(() => {
    const d = detail();
    setBadgeFlags(d ? (d.user.public_flags ?? 0) : null);
    // New user selected - drop any recovery codes shown for the previous one.
    void props.userId;
    setNoticeText('');
    setNoticeError('');
    setNoticeSent(false);
    setRecoveryResult(null);
  });

  async function toggleBadge(userId: string, bit: number) {
    const cur = badgeFlags() ?? 0;
    const next = cur ^ bit;
    setBadgeFlags(next);
    setBadgeSaving(true);
    setError('');
    try {
      const res = await setUserBadges(userId, next);
      setBadgeFlags(res.public_flags);
    } catch {
      setBadgeFlags(cur);
      setError(t('admin.actionFailed'));
    } finally {
      setBadgeSaving(false);
    }
  }

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

  async function regenerateRecovery(d: UserDetail) {
    const ok = await confirmDialog({
      title: t('admin.users.recoveryTitle', { name: nameOf(d.user) }),
      body: t('admin.users.recoveryBody'),
      confirmLabel: t('admin.users.recoveryRegen'),
      tone: 'danger',
    });
    if (!ok) return;
    setRecoveryBusy(true);
    setError('');
    setRecoveryResult(null);
    try {
      setRecoveryResult(await regenerateUserRecoveryCodes(d.user.id));
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function sendNotice(d: UserDetail) {
    const text = noticeText().trim();
    if (!text) return;
    setNoticeBusy(true);
    setNoticeError('');
    setNoticeSent(false);
    try {
      await sendUserNotice(d.user.id, text);
      setNoticeText('');
      setNoticeSent(true);
    } catch (err) {
      setNoticeError(translateCaughtApiError(err, t).join(' ') || t('admin.actionFailed'));
    } finally {
      setNoticeBusy(false);
    }
  }

  return (
    <Show when={detail()} fallback={<AdminDetailSkeleton />}>
      {(d) => (
        <div class="space-y-4">
          <div class="relative overflow-hidden rounded-2xl border border-border bg-card/40">
            <div
              class="h-16 w-full"
              style={{
                'background-image':
                  'linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 28%, transparent), color-mix(in srgb, var(--color-primary) 4%, transparent))',
              }}
              aria-hidden="true"
            />
            <div class="-mt-8 flex items-start gap-4 px-4 pb-4">
              <MessageAvatar name={nameOf(d().user)} avatar={d().user.avatar} class="size-16 text-lg ring-4 ring-card" />
              <div class="min-w-0 flex-1 space-y-1.5 pt-9">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-base font-semibold">{nameOf(d().user)}</span>
                  <span class="text-sm text-muted-foreground">{tag(d().user)}</span>
                  <Show when={d().instance_admin}>
                    <span class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <i class="fa-solid fa-shield-halved text-[10px]" aria-hidden="true" /> {t('admin.users.adminBadge')}
                    </span>
                  </Show>
                  <Show when={d().user.home_domain}>
                    <span class="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      <i class="fa-solid fa-globe text-[10px]" aria-hidden="true" /> {t('admin.users.remote', { domain: d().user.home_domain ?? '' })}
                    </span>
                  </Show>
                  <Show when={d().ban}>
                    <span class="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      <i class="fa-solid fa-ban text-[10px]" aria-hidden="true" /> {t('admin.users.bannedBadge')}
                    </span>
                  </Show>
                </div>
                <dl class="grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                  <div><dt class="inline font-medium text-foreground/80">{t('admin.users.id')}: </dt><dd class="inline font-mono">{d().user.id}</dd></div>
                  <div>
                    <dt class="inline font-medium text-foreground/80">{t('admin.users.email')}: </dt>
                    <dd class="inline">{d().user.email || '—'}</dd>
                    <Show when={!d().user.home_domain && !d().user.bot}>
                      <button type="button" class="ml-1.5 text-[11px] font-medium text-primary hover:underline" onClick={() => setEmailOpen(true)}>
                        {t('admin.users.changeEmail')}
                      </button>
                    </Show>
                  </div>
                  <div><dt class="inline font-medium text-foreground/80">{t('admin.users.created')}: </dt><dd class="inline">{when(d().user.created_at) || '—'}</dd></div>
                </dl>
              </div>
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

          <Show when={!d().user.home_domain}>
            <section class="space-y-2">
              <div class={settingsSectionTitle}>{t('admin.users.badges')}</div>
              <p class="px-0.5 text-xs text-muted-foreground">{t('admin.users.badgesHint')}</p>
              <div class="flex flex-wrap gap-1.5">
                <For each={BADGES}>
                  {(b) => {
                    const on = () => ((badgeFlags() ?? 0) & b.bit) !== 0;
                    return (
                      <button
                        type="button"
                        class={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                          on() ? 'border-primary bg-primary/15 text-foreground' : 'border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/30'
                        }`}
                        aria-pressed={on()}
                        disabled={badgeSaving()}
                        onClick={() => void toggleBadge(d().user.id, b.bit)}
                      >
                        <i class={`fa-solid ${b.icon} text-[13px]`} style={{ color: on() ? b.color : undefined }} aria-hidden="true" />
                        {t(`badges.${b.id}`)}
                        <Show when={on()}>
                          <i class="fa-solid fa-check text-[10px] text-primary" aria-hidden="true" />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </section>
          </Show>

          <Show when={!d().user.home_domain}>
            <section class="space-y-2">
              <div class={settingsSectionTitle}>{t('admin.users.recovery')}</div>
              <p class="px-0.5 text-xs text-muted-foreground">{t('admin.users.recoveryHint')}</p>
              <Button variant="outline" size="sm" disabled={recoveryBusy()} onClick={() => void regenerateRecovery(d())}>
                <i class="fa-solid fa-key text-xs" aria-hidden="true" /> {t('admin.users.recoveryRegen')}
              </Button>
              <Show when={recoveryResult()}>
                {(r) => (
                  <Show
                    when={!r().emailed}
                    fallback={
                      <p class="flex items-center gap-2 text-sm text-primary">
                        <i class="fa-solid fa-envelope-circle-check text-xs" aria-hidden="true" />
                        {t('admin.users.recoveryEmailed')}
                      </p>
                    }
                  >
                    <div class={`${settingsGroupFrame} space-y-2`}>
                      <p class="text-xs text-muted-foreground">{t('admin.users.recoveryCopyHint')}</p>
                      <div class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
                        <For each={r().codes ?? []}>{(c) => <span>{c}</span>}</For>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void navigator.clipboard?.writeText((r().codes ?? []).join('\n'))}
                      >
                        <i class="fa-solid fa-copy text-xs" aria-hidden="true" /> {t('admin.users.recoveryCopy')}
                      </Button>
                    </div>
                  </Show>
                )}
              </Show>
            </section>
          </Show>

          <Show when={!d().user.home_domain && !d().user.bot}>
            <section class="space-y-2">
              <div class={settingsSectionTitle}>{t('admin.users.notice')}</div>
              <p class="px-0.5 text-xs text-muted-foreground">{t('admin.users.noticeHint')}</p>
              <Textarea
                rows={3}
                value={noticeText()}
                onInput={(e) => {
                  setNoticeText(e.currentTarget.value);
                  setNoticeSent(false);
                }}
                placeholder={t('admin.users.noticePlaceholder')}
                disabled={noticeBusy()}
                maxLength={2000}
              />
              <Show when={noticeError()}>
                <p class="text-sm text-destructive">{noticeError()}</p>
              </Show>
              <div class="flex items-center gap-2">
                <Button size="sm" disabled={noticeBusy() || !noticeText().trim()} onClick={() => void sendNotice(d())}>
                  <i class="fa-solid fa-paper-plane text-xs" aria-hidden="true" /> {t('admin.users.noticeSend')}
                </Button>
                <Show when={noticeSent()}>
                  <span class="flex items-center gap-1.5 text-sm text-primary">
                    <i class="fa-solid fa-circle-check text-xs" aria-hidden="true" />
                    {t('admin.users.noticeSent')}
                  </span>
                </Show>
              </div>
            </section>
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
            sessionCount={d().sessions.length}
            onClose={() => setBanOpen(false)}
            onBanned={() => {
              setBanOpen(false);
              void refetch();
            }}
          />
          <EmailDialog
            user={emailOpen() ? d().user : null}
            onClose={() => setEmailOpen(false)}
            onChanged={() => {
              setEmailOpen(false);
              void refetch();
            }}
          />
        </div>
      )}
    </Show>
  );
};

const BanDialog: Component<{ user: AdminUser | null; sessionCount: number; onClose: () => void; onBanned: () => void }> = (props) => {
  const [reason, setReason] = createSignal('');
  const [seconds, setSeconds] = createSignal(0);
  const [banIPs, setBanIPs] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function submit(e: Event) {
    e.preventDefault();
    const u = props.user;
    if (!u) return;
    setBusy(true);
    setError('');
    try {
      await banUser(u.id, { reason: reason().trim(), max_age_seconds: seconds(), ban_ips: banIPs() && props.sessionCount > 0 });
      setReason('');
      setBanIPs(false);
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
            <Show when={props.sessionCount > 0}>
              <Checkbox
                checked={banIPs()}
                disabled={busy()}
                onChange={setBanIPs}
                label={t('admin.users.banIPs', { count: props.sessionCount })}
                description={t('admin.users.banIPsHint')}
              />
            </Show>
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

/** Admin: move an account to a new email address (support for "I lost my old mailbox"). */
const EmailDialog: Component<{ user: AdminUser | null; onClose: () => void; onChanged: () => void }> = (props) => {
  const [email, setEmail] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function submit(e: Event) {
    e.preventDefault();
    const u = props.user;
    const next = email().trim();
    if (!u || !next) return;
    setBusy(true);
    setError('');
    try {
      await setUserEmail(u.id, next);
      setEmail('');
      props.onChanged();
    } catch (err) {
      // The server's reason is the useful part: invalid address, already in use.
      setError(translateCaughtApiError(err, t).join(' ') || t('admin.actionFailed'));
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
          title={t('admin.users.changeEmailTitle', { name: nameOf(u()) })}
          description={t('admin.users.changeEmailBody')}
          icon="fa-solid fa-envelope"
        >
          <form onSubmit={submit} class="space-y-4">
            <Input
              type="email"
              label={t('admin.users.newEmail')}
              placeholder={u().email || 'name@example.com'}
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              disabled={busy()}
              autocomplete="off"
              required
            />
            <Show when={error()}>
              <p class="text-sm text-destructive">{error()}</p>
            </Show>
            <div class={appDialogActions}>
              <Button type="button" variant="ghost" onClick={props.onClose} disabled={busy()}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy()} disabled={!email().trim()}>{t('admin.users.confirmChangeEmail')}</Button>
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
  // Same shape as Users: the tab's <Show> keeps this mounted, so a later "open report"
  // changes focusReport without a remount and the one-shot seed would keep the old one.
  createEffect(() => {
    const id = props.focusReport;
    if (id) setSelected(id);
  });

  const targetLabel = (r: ReportRow) =>
    r.report.target_type === 'user' ? nameOf(r.target_user) : r.target_space?.name || t('admin.space.gone');

  return (
    <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-3">
        <AdminFilterTabs<ReportStatus>
          value={status()}
          onChange={(s) => { setStatus(s); setSelected(null); }}
          items={[
            { id: 'open', icon: 'fa-inbox', label: t('admin.reports.status.open') },
            { id: 'resolved', icon: 'fa-circle-check', label: t('admin.reports.status.resolved') },
            { id: 'dismissed', icon: 'fa-circle-xmark', label: t('admin.reports.status.dismissed') },
          ]}
        />
        <Show when={rows()}>
          {(list) => (
            <Show when={list().length > 0} fallback={<EmptyState icon="fa-flag" title={t('admin.reports.empty')} size="inline" />}>
              <div class="space-y-1.5">
                <For each={list()}>
                  {(r, i) => (
                    <button
                      type="button"
                      style={{ 'animation-delay': `${Math.min(i() * 30, 300)}ms` }}
                      class={`admin-row-in ${settingsRowShell} w-full text-start ${
                        selected() === r.report.id ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''
                      }`}
                      onClick={() => setSelected(r.report.id)}
                    >
                      <div class={`${settingsRowIcon} ${selected() === r.report.id ? 'bg-primary/15 text-primary' : ''}`}>
                        <i class={`fa-solid ${r.report.target_type === 'space' ? 'fa-layer-group' : 'fa-user'}`} aria-hidden="true" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-medium text-destructive">
                            <i class="fa-solid fa-flag text-[9px]" aria-hidden="true" />
                            {t(`report.reasons.${r.report.reason}`)}
                          </span>
                          <span class="truncate text-sm font-medium">{targetLabel(r)}</span>
                        </div>
                        <div class="truncate text-xs text-muted-foreground">
                          {t('admin.reports.by', { name: nameOf(r.reporter) })} · {when(r.report.created_at)}
                        </div>
                      </div>
                      <Show when={selected() === r.report.id}>
                        <i class="fa-solid fa-chevron-right shrink-0 text-xs text-primary" aria-hidden="true" />
                      </Show>
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
    <Show when={detail()} fallback={<AdminDetailSkeleton banner={false} />}>
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

const Bans: Component<{ onOpenUser: (id: string) => void }> = (props) => (
  <div class="space-y-8">
    <section class="space-y-3">
      <div class={settingsSectionTitle}>{t('admin.bans.accountsTitle')}</div>
      <AccountBans onOpenUser={props.onOpenUser} />
    </section>
    <IPBans />
  </div>
);

/** Banned networks: the list plus the form that adds one. Lifting asks first. */
const IPBans: Component = () => {
  const [rows, { refetch }] = createResource(() => listIPBans());
  const [cidr, setCidr] = createSignal('');
  const [reason, setReason] = createSignal('');
  const [seconds, setSeconds] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  async function add(e: Event) {
    e.preventDefault();
    const c = cidr().trim();
    if (!c) return;
    setBusy(true);
    setError('');
    try {
      await banIP({ cidr: c, reason: reason().trim(), max_age_seconds: seconds() });
      setCidr('');
      setReason('');
      await refetch();
    } catch (err) {
      // The server's validation ("not a CIDR", "too wide", "already banned") is the useful part.
      setError(translateCaughtApiError(err, t).join(' ') || t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function lift(c: string) {
    const ok = await confirmDialog({ title: t('admin.bans.ipLiftTitle', { cidr: c }), body: t('admin.bans.ipLiftBody'), confirmLabel: t('admin.bans.ipLift') });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await unbanIP(c);
      await refetch();
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section class="space-y-3">
      <div class="space-y-1">
        <div class={settingsSectionTitle}>{t('admin.bans.ipTitle')}</div>
        <p class="px-0.5 text-xs text-muted-foreground">{t('admin.bans.ipHint')}</p>
      </div>
      <form onSubmit={add} class={`${settingsGroupFrame} space-y-3`}>
        <div class="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('admin.bans.ipCidr')}
            placeholder="203.0.113.0/24"
            value={cidr()}
            onInput={(e) => setCidr(e.currentTarget.value)}
            disabled={busy()}
            autocomplete="off"
            spellcheck={false}
          />
          <Input
            label={t('admin.users.banReason')}
            placeholder={t('admin.bans.ipReasonPlaceholder')}
            value={reason()}
            onInput={(e) => setReason(e.currentTarget.value)}
            maxlength={500}
            disabled={busy()}
          />
        </div>
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
        <div class="flex justify-end">
          <Button type="submit" variant="destructive" size="sm" loading={busy()} disabled={!cidr().trim()}>
            {t('admin.bans.ipBan')}
          </Button>
        </div>
      </form>
      <Show when={rows()} fallback={<AdminListSkeleton rows={4} />}>
        {(list) => (
          <Show when={list().length > 0} fallback={<EmptyState icon="fa-network-wired" title={t('admin.bans.ipEmpty')} size="inline" />}>
            <div class="space-y-1.5">
              <For each={list()}>
                {(row, i) => (
                  <div style={{ 'animation-delay': `${Math.min(i() * 30, 300)}ms` }} class={`admin-row-in ${settingsRowShell}`}>
                    <div class={`${settingsRowIcon} bg-destructive/10 text-destructive`}><i class="fa-solid fa-network-wired" aria-hidden="true" /></div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate font-mono text-sm">{row.ban.cidr}</div>
                      <div class="truncate text-xs text-muted-foreground">
                        {row.ban.reason || t('admin.users.noReason')} · {row.ban.expires_at ? t('admin.users.bannedUntil', { when: when(row.ban.expires_at) }) : t('admin.users.bannedForever')} · {t('admin.bans.ipBy', { name: nameOf(row.banned_by) })}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled={busy()} onClick={() => void lift(row.ban.cidr)}>{t('admin.bans.ipLift')}</Button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        )}
      </Show>
    </section>
  );
};

const AccountBans: Component<{ onOpenUser: (id: string) => void }> = (props) => {
  const [rows, { refetch }] = createResource(() => listBans());
  async function lift(userId: string, name: string) {
    const ok = await confirmDialog({ title: t('admin.users.unbanTitle', { name }), body: t('admin.users.unbanBody'), confirmLabel: t('admin.users.unban') });
    if (!ok) return;
    await unbanUser(userId).catch(() => undefined);
    void refetch();
  }
  return (
    <Show when={rows()} fallback={<AdminListSkeleton rows={4} />}>
      {(list) => (
        <Show when={list().length > 0} fallback={<EmptyState icon="fa-ban" title={t('admin.bans.empty')} size="inline" />}>
          <div class="space-y-1.5">
            <For each={list()}>
              {(row, i) => (
                <div style={{ 'animation-delay': `${Math.min(i() * 30, 300)}ms` }} class={`admin-row-in ${settingsRowShell}`}>
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
  user_recovery_regen: 'fa-key',
  space_takedown: 'fa-trash',
  report_resolve: 'fa-check',
  report_dismiss: 'fa-xmark',
  invite_create: 'fa-ticket',
  invite_revoke: 'fa-ticket',
  discover_approve: 'fa-compass',
  discover_deny: 'fa-compass',
  discover_remove: 'fa-compass',
};

const Audit: Component<{ onOpenUser: (id: string) => void }> = (props) => {
  const [rows] = createResource(() => listAudit());
  return (
    <Show when={rows()} fallback={<AdminListSkeleton rows={6} />}>
      {(list) => (
        <Show when={list().length > 0} fallback={<EmptyState icon="fa-clock-rotate-left" title={t('admin.audit.empty')} size="inline" />}>
          <ol class="space-y-1.5">
            <For each={list()}>
              {(row, i) => (
                <li
                  style={{ 'animation-delay': `${Math.min(i() * 25, 300)}ms` }}
                  class="admin-row-in relative flex gap-3"
                >
                  <div class="relative flex w-9 shrink-0 justify-center">
                    <span class="absolute inset-y-0 w-px bg-border/70" aria-hidden="true" />
                    <span class="relative mt-2.5 flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                      <i class={`fa-solid ${AUDIT_ICON[row.entry.action] ?? 'fa-circle-info'} text-xs`} aria-hidden="true" />
                    </span>
                  </div>
                  <div class={`${settingsRowShell} min-w-0 flex-1`}>
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
                </li>
              )}
            </For>
          </ol>
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
  const [official, setOfficial] = createSignal(false);
  createEffect(() => {
    const d = detail();
    if (d) setOfficial(d.space.official === true);
  });
  async function toggleOfficial(on: boolean) {
    const d = detail();
    if (!d) return;
    setBusy(true);
    setError('');
    try {
      const res = await setSpaceOfficial(d.space.id, on);
      setOfficial(res.official);
    } catch {
      setError(t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

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
        <Show when={detail()} fallback={<AdminDetailSkeleton banner={false} />}>
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
              <div class={`${settingsGroupFrame} flex items-center justify-between gap-3`}>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{t('admin.space.official')}</div>
                  <p class="text-xs text-muted-foreground">{t('admin.space.officialHint')}</p>
                </div>
                <Toggle checked={official()} disabled={busy()} onChange={(on) => void toggleOfficial(on)} />
              </div>
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

/** Admin: the instance's federation allow/block list. Editable runtime entries are merged
 * with the read-only FEDERATION_ALLOWLIST/BLOCKLIST env lists by the server; a non-empty
 * allowlist (from either source) puts the instance in allowlist-only mode. */
type FedKind = 'allow' | 'block';

const FED_KIND: Record<FedKind, { icon: string; section: string; header: string }> = {
  allow: { icon: 'fa-circle-check', section: 'border-primary/30', header: 'bg-primary/10 text-primary' },
  block: { icon: 'fa-ban', section: 'border-destructive/30', header: 'bg-destructive/10 text-destructive' },
};

/** One domain line in a federation list. `removable` marks admin-added entries; the rest
 * come from the environment and are read-only. */
const FedRow: Component<{ dom: string; busy: boolean; removable: boolean; onRemove: (dom: string) => void }> = (props) => (
  <div class="admin-row-in flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
    <span class="truncate font-mono text-sm">{props.dom}</span>
    <Show
      when={props.removable}
      fallback={
        <span class="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('admin.federation.fromConfig')}
        </span>
      }
    >
      <Button variant="ghost" size="sm" disabled={props.busy} onClick={() => props.onRemove(props.dom)} aria-label={t('admin.federation.remove')}>
        <i class="fa-solid fa-xmark text-xs" aria-hidden="true" /> {t('admin.federation.remove')}
      </Button>
    </Show>
  </div>
);

/** One federation rule list: header, an add field that already knows whether it allows or
 * blocks, the entries, and the read-only ones from the environment. Because each list
 * carries its own form, there is no allow/block switch to miss. */
const FederationDomainList: Component<{
  kind: FedKind;
  entries: PeerPolicyRow[];
  envEntries: string[];
  busy: boolean;
  onAdd: (domain: string) => void;
  onRemove: (domain: string) => void;
}> = (props) => {
  const [value, setValue] = createSignal('');
  const meta = () => FED_KIND[props.kind];
  const total = () => props.entries.length + props.envEntries.length;

  function submit(e: Event) {
    e.preventDefault();
    const d = value().trim();
    if (!d) return;
    props.onAdd(d);
    setValue('');
  }

  return (
    <section class={`flex flex-col overflow-hidden rounded-2xl border bg-card/40 ${meta().section}`}>
      <header class={`flex items-center gap-2 px-4 py-3 ${meta().header}`}>
        <i class={`fa-solid ${meta().icon}`} aria-hidden="true" />
        <h3 class="text-sm font-semibold">
          {props.kind === 'allow' ? t('admin.federation.allowHeading') : t('admin.federation.blockHeading')}
        </h3>
        <span class="ml-auto rounded-full bg-background/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums">{total()}</span>
      </header>
      <p class="px-4 pt-3 text-xs text-muted-foreground">
        {props.kind === 'allow' ? t('admin.federation.allowHint') : t('admin.federation.blockHint')}
      </p>
      <form onSubmit={submit} class="flex items-center gap-2 px-4 py-3">
        <input
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          placeholder={t('admin.federation.domainPlaceholder')}
          class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autocapitalize="off"
          autocomplete="off"
          spellcheck={false}
          aria-label={props.kind === 'allow' ? t('admin.federation.addAllow') : t('admin.federation.addBlock')}
        />
        <Button
          type="submit"
          size="sm"
          variant={props.kind === 'allow' ? 'primary' : 'destructive'}
          disabled={props.busy || !value().trim()}
        >
          <i class={`fa-solid ${props.kind === 'allow' ? 'fa-plus' : 'fa-ban'} text-xs`} aria-hidden="true" />
          {props.kind === 'allow' ? t('admin.federation.addAllow') : t('admin.federation.addBlock')}
        </Button>
      </form>
      <div class="space-y-1 px-4 pb-4">
        <For each={props.entries}>{(e) => <FedRow dom={e.domain} busy={props.busy} removable onRemove={props.onRemove} />}</For>
        <For each={props.envEntries}>{(d) => <FedRow dom={d} busy={props.busy} removable={false} onRemove={props.onRemove} />}</For>
        <Show when={total() === 0}>
          <p class="px-0.5 py-1 text-xs text-muted-foreground">{t('admin.federation.empty')}</p>
        </Show>
      </div>
    </section>
  );
};

const FederationPanel: Component = () => {
  const [policy, { refetch }] = createResource(listFederationPolicy);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  const allowlistActive = () => {
    const p = policy();
    return !!p && (p.allow.length > 0 || (p.env_allow?.length ?? 0) > 0);
  };

  async function add(domain: string, kind: FedKind) {
    setBusy(true);
    setError('');
    try {
      await setFederationPolicy(domain, kind);
      await refetch();
    } catch {
      setError(t('admin.federation.invalid'));
    } finally {
      setBusy(false);
    }
  }
  async function remove(dom: string) {
    setBusy(true);
    setError('');
    try {
      await removeFederationPolicy(dom);
      await refetch();
    } catch {
      setError(t('admin.federation.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="space-y-5">
      <Show when={policy()} fallback={<AdminListSkeleton rows={3} />}>
        {(p) => (
          <Show
            when={p().enabled}
            fallback={
              <div class={`${settingsGroupFrame} flex items-center gap-3 text-sm text-muted-foreground`}>
                <i class="fa-solid fa-plug-circle-xmark text-lg" aria-hidden="true" />
                {t('admin.federation.disabled')}
              </div>
            }
          >
            <div class="flex items-center gap-3">
              <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-lg text-primary">
                <i class="fa-solid fa-globe" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <h2 class="text-base font-semibold">{t('admin.federation.title')}</h2>
                <p class="truncate text-xs text-muted-foreground">{t('admin.federation.self', { domain: p().domain })}</p>
              </div>
            </div>

            <div
              class={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs ${
                allowlistActive()
                  ? 'border-amber-500/40 bg-amber-500/10 text-foreground'
                  : 'border-primary/30 bg-primary/5 text-foreground'
              }`}
            >
              <i
                class={`fa-solid mt-0.5 ${allowlistActive() ? 'fa-lock text-amber-400' : 'fa-lock-open text-primary'}`}
                aria-hidden="true"
              />
              <span>{allowlistActive() ? t('admin.federation.allowlistMode') : t('admin.federation.openMode')}</span>
            </div>

            <Show when={error()}>
              <p class="text-sm text-destructive" role="alert">{error()}</p>
            </Show>

            <div class="grid gap-5 lg:grid-cols-2">
              <FederationDomainList
                kind="allow"
                entries={p().allow}
                envEntries={p().env_allow ?? []}
                busy={busy()}
                onAdd={(d) => void add(d, 'allow')}
                onRemove={(d) => void remove(d)}
              />
              <FederationDomainList
                kind="block"
                entries={p().block}
                envEntries={p().env_block ?? []}
                busy={busy()}
                onAdd={(d) => void add(d, 'block')}
                onRemove={(d) => void remove(d)}
              />
            </div>

            <Show when={(p().env_allow?.length ?? 0) + (p().env_block?.length ?? 0) > 0}>
              <p class="flex items-center gap-2 text-xs text-muted-foreground">
                <i class="fa-solid fa-circle-info text-[11px]" aria-hidden="true" />
                {t('admin.federation.envHint')}
              </p>
            </Show>
          </Show>
        )}
      </Show>
    </div>
  );
};
