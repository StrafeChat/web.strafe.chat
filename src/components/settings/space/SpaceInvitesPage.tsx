import type { Component } from 'solid-js';
import { createSignal, For, onMount, Show } from 'solid-js';
import { createSpaceInvite, deleteSpaceInvite, listSpaceInvites, type SpaceInvite } from '../../../api/spaces';
import { confirmDialog } from '../../../stores/confirmDialog';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { UserCell } from '../../ui/UserCell';
import { EmptyState } from '../../ui/EmptyState';
import { appTable, appTableCell, appTableFrame, appTableHeadCell, appTableRow } from '../../../theme/appChrome';
import { settingsGroupFrame, settingsSectionTitle } from '../settingsChrome';
import { formatDate, t } from '../../../i18n';

interface Props {
  spaceId: string;
  canManage: boolean;
  onError: (msg: string) => void;
}

const EXPIRY_OPTIONS = [0, 1800, 3600, 21600, 43200, 86400, 604800] as const;
const USES_OPTIONS = [0, 1, 5, 10, 25, 50, 100] as const;

function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

/** Space settings → Invites: every live invite with uses/expiry, create new ones, revoke. */
export const SpaceInvitesPage: Component<Props> = (props) => {
  const [invites, setInvites] = createSignal<SpaceInvite[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [creating, setCreating] = createSignal(false);
  const [maxAge, setMaxAge] = createSignal('0');
  const [maxUses, setMaxUses] = createSignal('0');
  const [copiedCode, setCopiedCode] = createSignal('');
  const [busyCode, setBusyCode] = createSignal('');

  async function refresh() {
    setLoading(true);
    props.onError('');
    try {
      const list = await listSpaceInvites(props.spaceId);
      setInvites([...list].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.invites.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  async function create() {
    setCreating(true);
    props.onError('');
    try {
      const inv = await createSpaceInvite(props.spaceId, {
        max_age_seconds: Number(maxAge()) || 0,
        max_uses: Number(maxUses()) || 0,
      });
      setInvites((prev) => [inv, ...prev]);
      await copy(inv.code);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('invite.failed'));
    } finally {
      setCreating(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? '' : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  async function revoke(inv: SpaceInvite) {
    const ok = await confirmDialog({
      title: t('spaceSettings.invites.revokeTitle'),
      body: t('spaceSettings.invites.revokeBody', { code: inv.code }),
      confirmLabel: t('spaceSettings.invites.revoke'),
      tone: 'danger',
      icon: 'fa-solid fa-link-slash',
    });
    if (!ok) return;
    setBusyCode(inv.code);
    props.onError('');
    try {
      await deleteSpaceInvite(props.spaceId, inv.code);
      setInvites((prev) => prev.filter((i) => i.code !== inv.code));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.invites.revokeFailed'));
    } finally {
      setBusyCode('');
    }
  }

  const expiryLabel = (s: number) =>
    s === 0
      ? t('spaceSettings.invites.never')
      : s < 3600
        ? t('spaceSettings.system.minutes', { count: s / 60 })
        : s < 86400
          ? t('spaceSettings.invites.hours', { count: s / 3600 })
          : t('spaceSettings.invites.days', { count: s / 86400 });

  return (
    <div class="space-y-6">
      <Show when={props.canManage}>
        <section class="space-y-3">
          <h3 class={settingsSectionTitle}>{t('spaceSettings.invites.createTitle')}</h3>
          <div class={`flex flex-col gap-3 sm:flex-row sm:items-end ${settingsGroupFrame}`}>
            <Select label={t('spaceSettings.invites.expireAfter')} value={maxAge()} onValueChange={setMaxAge} disabled={creating()}>
              <For each={[...EXPIRY_OPTIONS]}>{(s) => <option value={String(s)}>{expiryLabel(s)}</option>}</For>
            </Select>
            <Select label={t('spaceSettings.invites.maxUses')} value={maxUses()} onValueChange={setMaxUses} disabled={creating()}>
              <For each={[...USES_OPTIONS]}>
                {(n) => <option value={String(n)}>{n === 0 ? t('spaceSettings.invites.unlimited') : t('spaceSettings.invites.uses', { count: n })}</option>}
              </For>
            </Select>
            <Button class="shrink-0" onClick={() => void create()} loading={creating()}>
              <i class="fa-solid fa-link text-xs" aria-hidden="true" />
              {t('spaceSettings.invites.create')}
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">{t('spaceSettings.invites.createHint')}</p>
        </section>
      </Show>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class={settingsSectionTitle}>{t('spaceSettings.invites.activeTitle', { count: invites().length })}</h3>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={loading()}>
            <i class="fa-solid fa-rotate text-xs" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        </div>
        <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">{t('common.loading')}</p>}>
          <Show when={invites().length > 0} fallback={<EmptyState icon="fa-solid fa-link" body={t('spaceSettings.invites.none')} />}>
            <div class={appTableFrame}>
              <table class={appTable}>
                <thead>
                  <tr>
                    <th class={appTableHeadCell}>{t('spaceSettings.invites.colInviter')}</th>
                    <th class={appTableHeadCell}>{t('spaceSettings.invites.colCode')}</th>
                    <th class={appTableHeadCell}>{t('spaceSettings.invites.colUses')}</th>
                    <th class={appTableHeadCell}>{t('spaceSettings.invites.colExpires')}</th>
                    <th class={appTableHeadCell}>{t('spaceSettings.invites.colCreated')}</th>
                    <th class={`${appTableHeadCell} w-20`}>
                      <span class="sr-only">{t('spaceSettings.members.colActions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={invites()}>
                    {(inv) => (
                      <tr class={appTableRow}>
                        <td class={appTableCell}>
                          <UserCell
                            size="sm"
                            name={inv.inviter?.display_name || inv.inviter?.username || t('common.someone')}
                            username={inv.inviter?.username}
                            discriminator={inv.inviter?.discriminator}
                            avatar={inv.inviter?.avatar}
                          />
                        </td>
                        <td class={`${appTableCell} font-mono text-xs`} dir="ltr">
                          {inv.code}
                        </td>
                        <td class={`${appTableCell} whitespace-nowrap tabular-nums`}>
                          {inv.current_uses} / {inv.max_uses > 0 ? inv.max_uses : '∞'}
                        </td>
                        <td class={`${appTableCell} whitespace-nowrap text-muted-foreground`}>
                          {inv.expires_at ? formatDate(inv.expires_at, { dateStyle: 'medium', timeStyle: 'short' }) : t('spaceSettings.invites.never')}
                        </td>
                        <td class={`${appTableCell} whitespace-nowrap text-muted-foreground`}>
                          {formatDate(inv.created_at, { dateStyle: 'medium' })}
                        </td>
                        <td class={`${appTableCell} text-end`}>
                          <div class="inline-flex items-center gap-1">
                            <IconButton
                              size="sm"
                              icon={copiedCode() === inv.code ? 'fa-solid fa-check' : 'fa-solid fa-copy'}
                              label={t('spaceSettings.invites.copyLink')}
                              onClick={() => void copy(inv.code)}
                            />
                            <IconButton
                              size="sm"
                              tone="danger"
                              icon="fa-solid fa-trash"
                              label={t('spaceSettings.invites.revoke')}
                              disabled={busyCode() === inv.code}
                              onClick={() => void revoke(inv)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </section>
    </div>
  );
};
