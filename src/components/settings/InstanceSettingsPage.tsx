import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { closeUserSettings } from '../../stores/userSettingsModal';
import {
  createInstanceInvite,
  listInstanceInvites,
  revokeInstanceInvite,
  type InstanceInvite,
} from '../../api/instance';
import { confirmDialog } from '../../stores/confirmDialog';
import { instance } from '../../stores/instance';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { formatDate, t } from '../../i18n';

const DAY = 24 * 60 * 60;

/** Matches the server's limits (instance.MaxInviteAgeSeconds / MaxInviteUses). */
const EXPIRY_CHOICES = [
  { seconds: 0, labelKey: 'settings.instance.noExpiry' },
  { seconds: DAY, labelKey: 'settings.instance.day' },
  { seconds: 7 * DAY, labelKey: 'settings.instance.week' },
  { seconds: 30 * DAY, labelKey: 'settings.instance.month' },
];
const USES_CHOICES = [
  { uses: 0, labelKey: 'settings.instance.unlimited' },
  { uses: 1, label: '1' },
  { uses: 5, label: '5' },
  { uses: 25, label: '25' },
];

const chip =
  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const chipOn = 'bg-primary/20 text-foreground ring-1 ring-inset ring-primary/30';
const chipOff = 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground';

/**
 * Instance-wide settings, shown only to an instance administrator. Today that is the
 * invite codes that admit new accounts while registration is closed.
 */
export const InstanceSettingsPage: Component = () => {
  const navigate = useNavigate();
  const [invites, setInvites] = createSignal<InstanceInvite[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [creating, setCreating] = createSignal(false);
  const [copied, setCopied] = createSignal('');

  const [note, setNote] = createSignal('');
  const [maxAge, setMaxAge] = createSignal(0);
  const [maxUses, setMaxUses] = createSignal(0);

  async function refresh() {
    setLoading(true);
    try {
      setInvites(await listInstanceInvites());
      setError('');
    } catch {
      setError(t('settings.instance.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  async function create() {
    setCreating(true);
    try {
      const inv = await createInstanceInvite({
        max_age_seconds: maxAge(),
        max_uses: maxUses(),
        note: note().trim(),
      });
      // Put it at the top rather than refetching: the operator's eye is already here, and
      // a new code appearing where they are looking is the point.
      setInvites((prev) => [inv, ...prev]);
      setNote('');
      setError('');
    } catch {
      setError(t('settings.instance.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(code: string) {
    const ok = await confirmDialog({
      title: t('settings.instance.revoke'),
      body: code,
      confirmLabel: t('settings.instance.revoke'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await revokeInstanceInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
    } catch {
      setError(t('settings.instance.loadFailed'));
    }
  }

  function copy(code: string) {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? '' : c)), 1500);
    });
  }

  const usesText = (inv: InstanceInvite) =>
    inv.max_uses > 0
      ? t('settings.instance.uses', { uses: String(inv.uses), max: String(inv.max_uses) })
      : t('settings.instance.usesUnlimited', { uses: String(inv.uses) });

  const expiryText = (inv: InstanceInvite) =>
    inv.expires_at
      ? t('settings.instance.expires', { when: formatDate(inv.expires_at, { dateStyle: 'medium' }) || inv.expires_at })
      : t('settings.instance.never');

  return (
    <div class="space-y-4">
      <a
        href="/admin"
        class={`${settingsRowShell} no-underline`}
        onClick={(e) => {
          e.preventDefault();
          closeUserSettings();
          navigate('/admin');
        }}
      >
        <div class={settingsRowIcon}><i class="fa-solid fa-shield-halved" aria-hidden="true" /></div>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-foreground">{t('settings.instance.dashboard')}</div>
          <div class="text-xs text-muted-foreground">{t('settings.instance.dashboardHint')}</div>
        </div>
        <i class="fa-solid fa-chevron-right text-xs text-muted-foreground" aria-hidden="true" />
      </a>

      <div class={settingsSectionTitle}>{t('settings.instance.invitesTitle')}</div>
      <p class="px-0.5 text-sm text-muted-foreground">{t('settings.instance.invitesDescription')}</p>

      {/* Codes still work when registration is open; they just are not needed. Saying so
          stops this page looking broken on an instance that has not closed signups. */}
      <Show when={!instance.inviteOnly}>
        <p class="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {t('settings.instance.openNotice')}
        </p>
      </Show>

      <div class={`${settingsGroupFrame} space-y-3`}>
        <Input
          type="text"
          label={t('settings.instance.note')}
          placeholder={t('settings.instance.notePlaceholder')}
          value={note()}
          onInput={(e) => setNote(e.currentTarget.value)}
          maxlength={100}
          disabled={creating()}
        />
        <div class="space-y-1.5">
          <div class="text-xs font-medium text-muted-foreground">{t('settings.instance.maxUses')}</div>
          <div class="flex flex-wrap gap-1.5">
            <For each={USES_CHOICES}>
              {(c) => (
                <button
                  type="button"
                  class={`${chip} ${maxUses() === c.uses ? chipOn : chipOff}`}
                  aria-pressed={maxUses() === c.uses}
                  onClick={() => setMaxUses(c.uses)}
                >
                  {c.labelKey ? t(c.labelKey) : c.label}
                </button>
              )}
            </For>
          </div>
        </div>
        <div class="space-y-1.5">
          <div class="text-xs font-medium text-muted-foreground">{t('settings.instance.expiry')}</div>
          <div class="flex flex-wrap gap-1.5">
            <For each={EXPIRY_CHOICES}>
              {(c) => (
                <button
                  type="button"
                  class={`${chip} ${maxAge() === c.seconds ? chipOn : chipOff}`}
                  aria-pressed={maxAge() === c.seconds}
                  onClick={() => setMaxAge(c.seconds)}
                >
                  {t(c.labelKey)}
                </button>
              )}
            </For>
          </div>
        </div>
        <Button onClick={() => void create()} loading={creating()} class="w-full sm:w-auto">
          {t('settings.instance.create')}
        </Button>
      </div>

      <Show when={error()}>
        <p class="px-0.5 text-sm text-destructive">{error()}</p>
      </Show>

      <Show when={!loading()} fallback={<p class="px-0.5 text-sm text-muted-foreground">…</p>}>
        <Show
          when={invites().length > 0}
          fallback={<p class="px-0.5 text-sm text-muted-foreground">{t('settings.instance.empty')}</p>}
        >
          <div class="space-y-2">
            <For each={invites()}>
              {(inv) => (
                <div class={settingsRowShell}>
                  <div class={settingsRowIcon}>
                    <i class="fa-solid fa-ticket" aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-mono text-sm font-semibold text-foreground">{inv.code}</div>
                    <div class="truncate text-xs text-muted-foreground">
                      {usesText(inv)} · {expiryText(inv)}
                      <Show when={inv.note}> · {inv.note}</Show>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => copy(inv.code)}>
                      {copied() === inv.code ? t('settings.instance.copied') : t('settings.instance.copy')}
                    </Button>
                    <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" onClick={() => void revoke(inv.code)}>
                      {t('settings.instance.revoke')}
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
};
