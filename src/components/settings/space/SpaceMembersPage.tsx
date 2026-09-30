import type { Component } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { kickSpaceMember, type Space, type SpaceMember, type SpaceRole } from '../../../api/spaces';
import { memberHighestRolePosition, spaceRoleColorHex } from '../../../lib/spacePermissions';
import { presence, isVisibleStatus } from '../../../stores/presence';
import { confirmDialog } from '../../../stores/confirmDialog';
import { showContextMenu, type ContextMenuItem } from '../../../stores/contextMenu';
import { IconButton } from '../../ui/IconButton';
import { SearchInput } from '../../ui/SearchInput';
import { Select } from '../../ui/Select';
import { UserCell } from '../../ui/UserCell';
import { EmptyState } from '../../ui/EmptyState';
import { BanMemberDialog } from './BanMemberDialog';
import { EditMemberRolesDialog } from './EditMemberRolesDialog';
import { appTable, appTableCell, appTableFrame, appTableHeadCell, appTableRow } from '../../../theme/appChrome';
import { formatDate, t } from '../../../i18n';

type SortKey = 'joined_desc' | 'joined_asc' | 'name';

interface Props {
  spaceId: string;
  space: Space | undefined;
  members: SpaceMember[];
  roles: SpaceRole[];
  viewerId: string | undefined;
  canKick: boolean;
  canBan: boolean;
  canManageRoles: boolean;
  onMembersUpdated: () => void;
  onError: (msg: string) => void;
}

const EVERYONE = '@everyone';

/** Space settings → Members: every member in a sortable, searchable table with moderation actions. */
export const SpaceMembersPage: Component<Props> = (props) => {
  const [query, setQuery] = createSignal('');
  const [roleFilter, setRoleFilter] = createSignal('');
  const [sort, setSort] = createSignal<SortKey>('joined_desc');
  const [banTarget, setBanTarget] = createSignal<{ id: string; name: string } | null>(null);
  const [rolesTarget, setRolesTarget] = createSignal<SpaceMember | null>(null);
  const [busyId, setBusyId] = createSignal('');

  const rolesById = createMemo(() => new Map(props.roles.map((r) => [r.id, r])));
  const everyoneId = () => props.space?.everyone_role_id ?? props.roles.find((r) => r.name === EVERYONE)?.id;
  const isOwner = (id: string) => props.space?.owner_id === id;
  const viewerHighest = createMemo(() => {
    const me = props.viewerId;
    if (!me) return -1;
    if (isOwner(me)) return Number.POSITIVE_INFINITY;
    const mine = props.members.find((m) => m.id === me);
    return memberHighestRolePosition(everyoneId(), props.roles, mine);
  });

  const memberName = (m: SpaceMember) => m.display_name || m.username;
  const customRolesOf = (m: SpaceMember) =>
    (m.roles ?? [])
      .filter((rid) => rid !== everyoneId())
      .map((rid) => rolesById().get(rid))
      .filter((r): r is SpaceRole => !!r)
      .sort((a, b) => b.position - a.position);

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const rf = roleFilter();
    let list = props.members.filter((m) => {
      if (rf && !(m.roles ?? []).includes(rf)) return false;
      if (!q) return true;
      return memberName(m).toLowerCase().includes(q) || m.username.toLowerCase().includes(q) || m.id === q;
    });
    const joined = (m: SpaceMember) => (m.joined_at ? new Date(m.joined_at).getTime() : 0);
    switch (sort()) {
      case 'joined_asc':
        list = [...list].sort((a, b) => joined(a) - joined(b));
        break;
      case 'name':
        list = [...list].sort((a, b) => memberName(a).localeCompare(memberName(b)));
        break;
      default:
        list = [...list].sort((a, b) => joined(b) - joined(a));
    }
    return list;
  });

  /** Kick / ban: never yourself, never the owner, and the target must rank below you. */
  function canModerate(m: SpaceMember): boolean {
    if (isOwner(m.id) || m.id === props.viewerId) return false;
    if (props.viewerId && isOwner(props.viewerId)) return true;
    return memberHighestRolePosition(everyoneId(), props.roles, m) < viewerHighest();
  }

  /**
   * Role editing is a separate question from moderation: you may edit your own roles
   * (the owner included - that is how they give themselves a colour), you may not edit
   * anyone else's owner roles, and otherwise the target must rank below you. The dialog
   * locks the individual roles you may not hand out.
   */
  function canEditRoles(m: SpaceMember): boolean {
    if (!props.canManageRoles) return false;
    if (m.id === props.viewerId) return true;
    if (isOwner(m.id)) return false;
    if (props.viewerId && isOwner(props.viewerId)) return true;
    return memberHighestRolePosition(everyoneId(), props.roles, m) < viewerHighest();
  }

  async function kick(m: SpaceMember) {
    const ok = await confirmDialog({
      title: t('room.members.kick'),
      body: t('spaceSettings.members.kickBody', { name: memberName(m) }),
      confirmLabel: t('room.members.kick'),
      tone: 'danger',
      icon: 'fa-solid fa-user-minus',
    });
    if (!ok) return;
    setBusyId(m.id);
    props.onError('');
    try {
      await kickSpaceMember(props.spaceId, m.id);
      props.onMembersUpdated();
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceSettings.members.kickFailed'));
    } finally {
      setBusyId('');
    }
  }

  function openMenu(e: MouseEvent, m: SpaceMember) {
    const items: ContextMenuItem[] = [];
    const mod = canModerate(m);
    if (props.canManageRoles && (canEditRoles(m) || !isOwner(m.id))) {
      // Shown disabled rather than hidden for a member ranked at or above you, so the
      // rule is visible; the server enforces the same one on PUT /members/:id/roles.
      items.push({
        label: t('spaceSettings.members.editRoles'),
        icon: 'fa-solid fa-shield-halved',
        disabled: !canEditRoles(m),
        onClick: () => setRolesTarget(m),
      });
    }
    if (props.canKick) items.push({ label: t('room.members.kick'), icon: 'fa-solid fa-user-minus', danger: true, disabled: !mod, onClick: () => void kick(m) });
    if (props.canBan) items.push({ label: t('room.members.ban'), icon: 'fa-solid fa-ban', danger: true, disabled: !mod, onClick: () => setBanTarget({ id: m.id, name: memberName(m) }) });
    if (items.length === 0) return;
    showContextMenu(e, items);
  }

  const hasActions = () => props.canKick || props.canBan || props.canManageRoles;
  /** Whether this row's menu would hold anything at all. */
  const hasMenu = (m: SpaceMember) =>
    (props.canManageRoles && (canEditRoles(m) || !isOwner(m.id))) || props.canKick || props.canBan;

  return (
    <div class="space-y-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-end">
        <SearchInput
          size="md"
          value={query()}
          onValueChange={setQuery}
          placeholder={t('spaceSettings.members.search')}
          aria-label={t('spaceSettings.members.search')}
          wrapperClass="flex-1"
        />
        <div class="grid grid-cols-2 gap-3 md:w-[26rem]">
          <Select value={roleFilter()} onValueChange={setRoleFilter} aria-label={t('spaceSettings.members.filterRole')}>
            <option value="">{t('spaceSettings.members.allRoles')}</option>
            <For each={props.roles.filter((r) => r.name !== EVERYONE)}>{(r) => <option value={r.id}>{r.name}</option>}</For>
          </Select>
          <Select value={sort()} onValueChange={(v) => setSort(v as SortKey)} aria-label={t('spaceSettings.members.sort')}>
            <option value="joined_desc">{t('spaceSettings.members.sortNewest')}</option>
            <option value="joined_asc">{t('spaceSettings.members.sortOldest')}</option>
            <option value="name">{t('spaceSettings.members.sortName')}</option>
          </Select>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">{t('spaceSettings.members.showing', { shown: filtered().length, total: props.members.length })}</p>

      <Show when={filtered().length > 0} fallback={<EmptyState icon="fa-solid fa-user-group" body={t('spaceSettings.members.none')} />}>
        <div class={appTableFrame}>
          <table class={appTable}>
            <thead>
              <tr>
                <th class={appTableHeadCell}>{t('spaceSettings.members.colMember')}</th>
                <th class={appTableHeadCell}>{t('spaceSettings.members.colRoles')}</th>
                <th class={appTableHeadCell}>{t('spaceSettings.members.colJoined')}</th>
                <Show when={hasActions()}>
                  <th class={`${appTableHeadCell} w-12`}>
                    <span class="sr-only">{t('spaceSettings.members.colActions')}</span>
                  </th>
                </Show>
              </tr>
            </thead>
            <tbody>
              <For each={filtered()}>
                {(m) => {
                  const status = () => presence.byUser[m.id]?.status ?? m.presence?.status;
                  const online = () => isVisibleStatus(status());
                  const roles = () => customRolesOf(m);
                  return (
                    <tr class={appTableRow} onContextMenu={(e) => hasActions() && openMenu(e, m)}>
                      <td class={appTableCell}>
                        <div class="flex items-center gap-2">
                          <UserCell name={memberName(m)} bot={m.bot} username={m.username} discriminator={m.discriminator} avatar={m.avatar} />
                          <Show when={isOwner(m.id)}>
                            <i class="fa-solid fa-crown text-[11px] text-amber-400" title={t('room.members.owner')} aria-hidden="true" />
                          </Show>
                          <span class={`ms-auto size-2 shrink-0 rounded-full ${online() ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} title={status() ?? 'offline'} />
                        </div>
                      </td>
                      <td class={appTableCell}>
                        <div class="flex flex-wrap gap-1">
                          <For each={roles().slice(0, 4)}>
                            {(r) => (
                              <span class="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-foreground">
                                <span class="size-2 rounded-full" style={{ 'background-color': spaceRoleColorHex(r.color ?? 0) }} />
                                {r.name}
                              </span>
                            )}
                          </For>
                          <Show when={roles().length > 4}>
                            <span class="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">+{roles().length - 4}</span>
                          </Show>
                          <Show when={roles().length === 0}>
                            <span class="text-xs text-muted-foreground">—</span>
                          </Show>
                        </div>
                      </td>
                      <td class={`${appTableCell} whitespace-nowrap text-muted-foreground`}>
                        {m.joined_at ? formatDate(m.joined_at, { dateStyle: 'medium' }) : '—'}
                      </td>
                      <Show when={hasActions()}>
                        <td class={`${appTableCell} text-end`}>
                          <IconButton
                            size="sm"
                            icon="fa-solid fa-ellipsis"
                            label={t('spaceSettings.members.actionsFor', { name: memberName(m) })}
                            disabled={busyId() === m.id || !hasMenu(m)}
                            onClick={(e) => openMenu(e, m)}
                          />
                        </td>
                      </Show>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={props.canKick || props.canBan}>
        <p class="text-xs text-muted-foreground">{t('spaceSettings.members.hierarchyHint')}</p>
      </Show>

      <BanMemberDialog
        spaceId={props.spaceId}
        target={banTarget()}
        onClose={() => setBanTarget(null)}
        onBanned={() => props.onMembersUpdated()}
      />
      <EditMemberRolesDialog
        spaceId={props.spaceId}
        member={rolesTarget()}
        roles={props.roles}
        viewerHighestPosition={viewerHighest()}
        onClose={() => setRolesTarget(null)}
        onSaved={() => props.onMembersUpdated()}
      />
    </div>
  );
};
