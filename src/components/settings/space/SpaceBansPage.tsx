import type { Component } from 'solid-js';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { listSpaceBans, unbanSpaceMember, type SpaceBan } from '../../../api/spaces';
import { confirmDialog } from '../../../stores/confirmDialog';
import { Button } from '../../ui/Button';
import { SearchInput } from '../../ui/SearchInput';
import { UserCell } from '../../ui/UserCell';
import { EmptyState } from '../../ui/EmptyState';
import { appTable, appTableCell, appTableFrame, appTableHeadCell, appTableRow } from '../../../theme/appChrome';
import { formatDate, t } from '../../../i18n';

interface Props {
  spaceId: string;
  canBan: boolean;
  onError: (msg: string) => void;
}

/** Space settings → Bans: who is banned, why, by whom, with a revoke action. */
export const SpaceBansPage: Component<Props> = (props) => {
  const [bans, setBans] = createSignal<SpaceBan[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [query, setQuery] = createSignal('');
  const [busyId, setBusyId] = createSignal('');

  async function refresh() {
    setLoading(true);
    props.onError('');
    try {
      const list = await listSpaceBans(props.spaceId);
      setBans([...list].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.bans.loadFailed'));
    } finally {
      setLoading(false);
    }
  }
  onMount(() => void refresh());

  const nameOf = (b: SpaceBan) => b.user?.display_name || b.user?.username || b.user_id;

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return bans();
    return bans().filter(
      (b) => nameOf(b).toLowerCase().includes(q) || (b.user?.username ?? '').toLowerCase().includes(q) || (b.reason ?? '').toLowerCase().includes(q)
    );
  });

  async function revoke(b: SpaceBan) {
    const ok = await confirmDialog({
      title: t('spaceSettings.bans.revokeTitle'),
      body: t('spaceSettings.bans.revokeBody', { name: nameOf(b) }),
      confirmLabel: t('spaceSettings.bans.revoke'),
      icon: 'fa-solid fa-user-check',
    });
    if (!ok) return;
    setBusyId(b.user_id);
    props.onError('');
    try {
      await unbanSpaceMember(props.spaceId, b.user_id);
      setBans((prev) => prev.filter((x) => x.user_id !== b.user_id));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.bans.revokeFailed'));
    } finally {
      setBusyId('');
    }
  }

  return (
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          size="md"
          value={query()}
          onValueChange={setQuery}
          placeholder={t('spaceSettings.bans.search')}
          aria-label={t('spaceSettings.bans.search')}
          wrapperClass="flex-1"
        />
        <p class="text-xs text-muted-foreground sm:ms-auto">{t('spaceSettings.bans.count', { count: bans().length })}</p>
      </div>
      <Show when={!loading()} fallback={<p class="text-sm text-muted-foreground">{t('common.loading')}</p>}>
        <Show when={filtered().length > 0} fallback={<EmptyState icon="fa-solid fa-ban" body={bans().length ? t('spaceSettings.bans.noMatch') : t('spaceSettings.bans.none')} />}>
          <div class={appTableFrame}>
            <table class={appTable}>
              <thead>
                <tr>
                  <th class={appTableHeadCell}>{t('spaceSettings.bans.colUser')}</th>
                  <th class={appTableHeadCell}>{t('spaceSettings.bans.colReason')}</th>
                  <th class={appTableHeadCell}>{t('spaceSettings.bans.colBy')}</th>
                  <th class={appTableHeadCell}>{t('spaceSettings.bans.colDate')}</th>
                  <Show when={props.canBan}>
                    <th class={`${appTableHeadCell} w-32`}>
                      <span class="sr-only">{t('spaceSettings.members.colActions')}</span>
                    </th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={filtered()}>
                  {(b) => (
                    <tr class={appTableRow}>
                      <td class={appTableCell}>
                        <UserCell name={nameOf(b)} username={b.user?.username} discriminator={b.user?.discriminator} avatar={b.user?.avatar} />
                      </td>
                      <td class={`${appTableCell} max-w-xs`}>
                        <span class={b.reason ? 'text-foreground' : 'text-muted-foreground'}>{b.reason || t('spaceSettings.bans.noReason')}</span>
                      </td>
                      <td class={appTableCell}>
                        <UserCell
                          size="sm"
                          name={b.banned_by_user?.display_name || b.banned_by_user?.username || t('common.someone')}
                          username={b.banned_by_user?.username}
                          avatar={b.banned_by_user?.avatar}
                        />
                      </td>
                      <td class={`${appTableCell} whitespace-nowrap text-muted-foreground`}>
                        {formatDate(b.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <Show when={props.canBan}>
                        <td class={`${appTableCell} text-end`}>
                          <Button size="sm" variant="outline" loading={busyId() === b.user_id} onClick={() => void revoke(b)}>
                            {t('spaceSettings.bans.revoke')}
                          </Button>
                        </td>
                      </Show>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </div>
  );
};
