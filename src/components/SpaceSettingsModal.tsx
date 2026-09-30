import type { Component } from 'solid-js';
import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import {
  createSpaceRole,
  deleteSpaceRole,
  patchSpaceRole,
  putRoomPermissionOverride,
  putRoomUserPermissionOverride,
  setMemberSpaceRoles,
  type Space,
  type SpaceMember,
  type SpaceRole,
} from '../api/spaces';
import {
  hasPerm,
  memberCanBanMembers,
  memberCanKickMembers,
  memberCanManageEmojis,
  memberCanManageRoles,
  memberCanManageSpace,
  memberHighestRolePosition,
  ROOM_OVERRIDE_PERM_ROWS,
  SPACE_ROLE_PERM_GROUPS,
  togglePerm,
} from '../lib/spacePermissions';
import type { PermRow } from '../lib/spacePermissions';
import {
  applyRoomRoleOverride,
  applyRoomUserOverride,
  ensureSpaceRoles,
  ensureSpaceRooms,
  removeSpaceRole,
  roomOverrides,
  spaceRoles,
  spaces,
  upsertSpaceRole,
} from '../stores/spaces';
import { auth } from '../stores/auth';
import { Button } from './ui/Button';
import { Input, inputBaseClass } from './ui/Input';
import { SearchInput } from './ui/SearchInput';
import { Select } from './ui/Select';
import { Tabs } from './ui/Tabs';
import { Toggle } from './ui/Toggle';
import { TriStateToggle, type TriState } from './ui/TriStateToggle';
import { UserCell } from './ui/UserCell';
import { createPointerDrag } from '../lib/dnd/createPointerDrag';
import { SettingsNav, SettingsPanel, SettingsShell, type SettingsNavGroup, type SettingsNavItemDef } from './settings';
import { SpaceEmojiSettings } from './settings/SpaceEmojiSettings';
import {
  SpaceAuditLogPage,
  SpaceBansPage,
  SpaceInvitesPage,
  SpaceMembersPage,
  SpaceOverviewPage,
  SpaceSystemPage,
} from './settings/space';
import { appSectionLabel } from '../theme/appChrome';
import { t } from '../i18n';

const EVERYONE = '@everyone';

/** Discord's default role palette, offered as quick swatches next to the custom colour picker. */
const ROLE_COLOR_SWATCHES = [
  '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
  '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b',
  '#11806a', '#1f8b4c', '#206694', '#71368a', '#ad1457',
  '#c27c0e', '#a84300', '#992d22', '#979c9f', '#546e7a',
];

/** Role color (24-bit RGB). */
function intToHex(c: number): string {
  const u = c >>> 0;
  return `#${(u & 0xffffff).toString(16).padStart(6, '0')}`;
}
function hexToInt(h: string): number {
  const s = h.trim().replace(/^#/, '');
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? 0 : n & 0xffffff;
}

type SpaceSettingsSection = 'general' | 'system' | 'roles' | 'emojis' | 'members' | 'invites' | 'bans' | 'audit';
type RolesSubTab = 'display' | 'permissions' | 'members' | 'channel';

interface SpaceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  space: Space | undefined;
  spaceId: string;
  roomId?: string | null;
  members: SpaceMember[];
  /** Create/edit roles, assign members (owner or Manage roles). */
  canManageRoles?: boolean;
  /** Edit space icon / name (owner or Manage space permission). */
  canManageSpace?: boolean;
  /** Upload/rename/delete custom emoji (owner, Manage emojis, or Manage space). */
  canManageEmojis?: boolean;
  ownerId: string;
  onMembersUpdated?: () => void;
}

export const SpaceSettingsModal: Component<SpaceSettingsModalProps> = (props) => {
  const [nav, setNav] = createSignal<SpaceSettingsSection>('general');
  const [rolesSubTab, setRolesSubTab] = createSignal<RolesSubTab>('display');
  const [selectedRoleId, setSelectedRoleId] = createSignal('');
  const [permMask, setPermMask] = createSignal(0);
  const [roleName, setRoleName] = createSignal('');
  const [roleColorHex, setRoleColorHex] = createSignal('#99aab5');
  const [roleHoist, setRoleHoist] = createSignal(false);
  const [roleMentionable, setRoleMentionable] = createSignal(false);
  const [newRoleName, setNewRoleName] = createSignal('');
  const [allowMask, setAllowMask] = createSignal(0);
  const [denyMask, setDenyMask] = createSignal(0);
  const [overrideTargetType, setOverrideTargetType] = createSignal<'role' | 'user'>('role');
  const [selectedOverrideUserId, setSelectedOverrideUserId] = createSignal('');
  const [memberSearch, setMemberSearch] = createSignal('');
  const [permSearch, setPermSearch] = createSignal('');
  const [err, setErr] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [dropIndicator, setDropIndicator] = createSignal<{
    overId: string;
    placement: 'before' | 'after';
  } | null>(null);

  // Roles and the current room's overrides come from the spaces store, which the gateway
  // keeps current; nothing is fetched when the modal opens.
  createEffect(() => {
    if (props.open) {
      void ensureSpaceRoles(props.spaceId);
      void ensureSpaceRooms(props.spaceId);
    }
  });
  const roles = createMemo(() => spaceRoles(props.spaceId));
  const spaceRoomList = createMemo(() => spaces.spaceRoomsBySpaceId[props.spaceId] ?? []);

  // Permissions are derived from the store so every mount site gets the same answer; the
  // explicit props remain as an override for callers that already computed them.
  const viewerId = () => auth.user?.id;
  const viewerMember = createMemo(() => props.members.find((m) => m.id === viewerId()));
  const canManageSpace = createMemo(
    () => props.canManageSpace === true || memberCanManageSpace(props.space, roles(), viewerMember(), viewerId())
  );
  const userCanManageRoles = createMemo(
    () => props.canManageRoles === true || memberCanManageRoles(props.space, roles(), viewerMember(), viewerId())
  );
  const userCanManageEmojis = createMemo(
    () => props.canManageEmojis === true || memberCanManageEmojis(props.space, roles(), viewerMember(), viewerId())
  );
  const canKick = createMemo(() => memberCanKickMembers(props.space, roles(), viewerMember(), viewerId()));
  const canBan = createMemo(() => memberCanBanMembers(props.space, roles(), viewerMember(), viewerId()));
  const canSeeMembers = createMemo(() => canManageSpace() || userCanManageRoles() || canKick() || canBan());

  const allowed = (id: SpaceSettingsSection): boolean => {
    switch (id) {
      case 'general':
      case 'system':
      case 'invites':
      case 'audit':
        return canManageSpace();
      case 'roles':
        return userCanManageRoles();
      case 'emojis':
        return userCanManageEmojis();
      case 'members':
        return canSeeMembers();
      case 'bans':
        return canBan();
    }
  };

  const navGroups = createMemo((): SettingsNavGroup<SpaceSettingsSection>[] => {
    const general: SettingsNavItemDef<SpaceSettingsSection>[] = [];
    if (allowed('general')) general.push({ id: 'general', label: t('spaceSettings.pages.general.title'), icon: 'fa-sliders' });
    if (allowed('system')) general.push({ id: 'system', label: t('spaceSettings.pages.system.title'), icon: 'fa-bullhorn' });
    if (allowed('roles')) general.push({ id: 'roles', label: t('spaceSettings.rolesPerms'), icon: 'fa-shield-halved' });
    if (allowed('emojis')) general.push({ id: 'emojis', label: t('spaceSettings.emojis'), icon: 'fa-face-smile' });
    const moderation: SettingsNavItemDef<SpaceSettingsSection>[] = [];
    if (allowed('members')) moderation.push({ id: 'members', label: t('spaceSettings.pages.members.title'), icon: 'fa-user-group' });
    if (allowed('invites')) moderation.push({ id: 'invites', label: t('spaceSettings.pages.invites.title'), icon: 'fa-link' });
    if (allowed('bans')) moderation.push({ id: 'bans', label: t('spaceSettings.pages.bans.title'), icon: 'fa-ban' });
    if (allowed('audit')) moderation.push({ id: 'audit', label: t('spaceSettings.pages.audit.title'), icon: 'fa-clipboard-list' });
    const groups: SettingsNavGroup<SpaceSettingsSection>[] = [];
    if (general.length) groups.push({ label: props.space?.name || t('emoji.picker.space'), items: general });
    if (moderation.length) groups.push({ label: t('spaceSettings.groups.moderation'), items: moderation });
    return groups;
  });

  /** Keep the active tab on a section the user is allowed to see. */
  createEffect(() => {
    if (!props.open) return;
    if (allowed(nav())) return;
    const first = navGroups()[0]?.items[0]?.id;
    if (first) setNav(first);
  });
  const overrides = createMemo(() => (props.roomId ? roomOverrides(props.spaceId, props.roomId).roles : undefined));
  const userOverrides = createMemo(() => (props.roomId ? roomOverrides(props.spaceId, props.roomId).users : undefined));

  createEffect(() => {
    if (!props.open) return;
    const list = roles();
    if (!list?.length) return;
    const cur = selectedRoleId();
    if (!cur || !list.some((r) => r.id === cur)) {
      setSelectedRoleId(list[0]!.id);
    }
  });

  createEffect(() => {
    const id = selectedRoleId();
    const list = roles();
    if (!id || !list) return;
    const r = list.find((x) => x.id === id);
    if (!r) return;
    setRoleName(r.name);
    setRoleColorHex(intToHex(r.color ?? 0));
    setRoleHoist(!!r.hoist);
    setRoleMentionable(!!r.mentionable);
    setPermMask(r.permissions);
  });

  createEffect(() => {
    if (nav() !== 'roles' || rolesSubTab() !== 'channel' || !props.roomId) return;
    const ovs = overrides();
    const userOvs = userOverrides();
    if (overrideTargetType() === 'role') {
      const id = selectedRoleId();
      if (id === '' || ovs === undefined) return;
      const o = ovs.find((x) => x.role_id === id);
      setAllowMask(o?.allow ?? 0);
      setDenyMask(o?.deny ?? 0);
      return;
    }
    const targetUserId = selectedOverrideUserId();
    if (!targetUserId || userOvs === undefined) return;
    const o = userOvs.find((x) => x.user_id === targetUserId);
    setAllowMask(o?.allow ?? 0);
    setDenyMask(o?.deny ?? 0);
  });

  /** Discord-style tri-state for one permission bit, derived from the allow/deny masks. */
  function overrideState(bit: number): TriState {
    if (hasPerm(denyMask(), bit)) return 'deny';
    if (hasPerm(allowMask(), bit)) return 'allow';
    return 'neutral';
  }
  function setOverrideState(bit: number, state: TriState) {
    setAllowMask((prev) => (state === 'allow' ? prev | bit : prev & ~bit));
    setDenyMask((prev) => (state === 'deny' ? prev | bit : prev & ~bit));
  }

  // Clear the "add members" search when switching roles, so it doesn't carry over.
  createEffect(() => {
    selectedRoleId();
    setMemberSearch('');
  });

  createEffect(() => {
    if (overrideTargetType() !== 'user') return;
    if (selectedOverrideUserId()) return;
    const first = props.members[0];
    if (first?.id) setSelectedOverrideUserId(first.id);
  });

  const currentRole = createMemo(() => {
    const list = roles();
    const id = selectedRoleId();
    if (!list || !id) return undefined;
    return list.find((r) => r.id === id);
  });

  const filteredPermGroups = createMemo(() => {
    const q = permSearch().trim().toLowerCase();
    if (!q) return SPACE_ROLE_PERM_GROUPS;
    return SPACE_ROLE_PERM_GROUPS.map((g) => ({
      category: g.category,
      rows: g.rows.filter(
        (row) => row.label.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
      ),
    })).filter((g) => g.rows.length > 0);
  });

  async function saveRole() {
    const sid = props.spaceId;
    const rid = selectedRoleId();
    const r = currentRole();
    if (!rid || !r || !props.canManageRoles) return;
    setBusy(true);
    setErr('');
    try {
      const body: {
        permissions: number;
        color: number;
        hoist: boolean;
        mentionable: boolean;
        name?: string;
      } = {
        permissions: permMask(),
        color: hexToInt(roleColorHex()),
        hoist: roleHoist(),
        mentionable: roleMentionable(),
      };
      if (r.name !== EVERYONE) {
        const n = roleName().trim();
        if (n) body.name = n;
      }
      upsertSpaceRole(sid, await patchSpaceRole(sid, rid, body));
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    const n = newRoleName().trim();
    if (!n || !props.canManageRoles) return;
    setBusy(true);
    setErr('');
    try {
      // Discord starts a new role as a copy of @everyone's current permissions, not empty -
      // toggles read as "on" for whatever a member can already do, off only for the extras
      // this role is meant to grant.
      const everyonePerms = roles()?.find((r) => r.name === EVERYONE)?.permissions ?? 0;
      upsertSpaceRole(props.spaceId, await createSpaceRole(props.spaceId, { name: n, permissions: everyonePerms }));
      setNewRoleName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('spaceSettings.createRoleFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeRole() {
    const rid = selectedRoleId();
    const r = roles()?.find((x) => x.id === rid);
    if (!rid || !r || r.name === EVERYONE || !props.canManageRoles) return;
    setBusy(true);
    setErr('');
    try {
      await deleteSpaceRole(props.spaceId, rid);
      removeSpaceRole(props.spaceId, rid);
      setSelectedRoleId('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('common.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function reorderRoles(dragId: string, overId: string, placement: 'before' | 'after') {
    if (!props.canManageRoles || busy()) return;
    if (!dragId || !overId) return;
    if (dragId === overId) return;

    const list = roles();
    if (!list?.length) return;
    const everyoneRow = list.find((r) => r.name === EVERYONE);
    const custom = list.filter((r) => r.name !== EVERYONE);

    const moved = custom.find((r) => r.id === dragId);
    if (!moved) return;

    const next = custom.filter((r) => r.id !== dragId);

    let insertAt: number;
    if (everyoneRow && overId === everyoneRow.id) {
      if (placement !== 'after') return;
      insertAt = 0;
    } else {
      const target = custom.find((r) => r.id === overId);
      if (!target) return;
      const ti = next.findIndex((r) => r.id === overId);
      if (ti < 0) return;
      insertAt = placement === 'before' ? ti : ti + 1;
    }

    next.splice(insertAt, 0, moved);

    const origIds = custom.map((x) => x.id);
    const newIds = next.map((x) => x.id);
    if (origIds.length === newIds.length && origIds.every((id, i) => id === newIds[i])) {
      return;
    }

    setBusy(true);
    setErr('');
    try {
      // Keep @everyone fixed at position 0. Custom roles get positions 1..N in their new order.
      for (let i = 0; i < next.length; i += 1) {
        upsertSpaceRole(props.spaceId, await patchSpaceRole(props.spaceId, next[i]!.id, { position: i + 1 }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('spaceSettings.reorderFailed'));
    } finally {
      setBusy(false);
    }
  }

  // --- Pointer-drag reordering for the role list (Discord-style, replaces native HTML5 drag) ---
  let roleListScrollEl: HTMLDivElement | undefined;
  const roleRowEls = new Map<string, HTMLElement>();

  /** The before/after slot the cursor is over among the custom roles (@everyone stays pinned). */
  function roleDropSlotAt(clientY: number): { overId: string; placement: 'before' | 'after' } | null {
    const custom = roles()?.filter((x) => x.name !== EVERYONE) ?? [];
    for (const role of custom) {
      const el = roleRowEls.get(role.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return { overId: role.id, placement: 'before' };
      if (clientY <= rect.bottom) return { overId: role.id, placement: 'after' };
    }
    const last = custom[custom.length - 1];
    return last ? { overId: last.id, placement: 'after' } : null;
  }

  const roleDrag = createPointerDrag({
    enabled: () => props.canManageRoles === true && !busy(),
    scrollEl: () => roleListScrollEl,
    onMove: (_id, _x, y) => setDropIndicator(roleDropSlotAt(y)),
    onDrop: (id) => {
      const slot = dropIndicator();
      if (slot && slot.overId !== id) void reorderRoles(id, slot.overId, slot.placement);
    },
    onEnd: () => setDropIndicator(null),
  });

  async function saveOverride() {
    const sid = props.spaceId;
    const rid = props.roomId;
    if (!rid || !props.canManageRoles) return;
    const allow = allowMask();
    const deny = denyMask();
    setBusy(true);
    setErr('');
    try {
      const now = new Date().toISOString();
      if (overrideTargetType() === 'role') {
        const roleId = selectedRoleId();
        if (!roleId) return;
        await putRoomPermissionOverride(sid, rid, roleId, { allow, deny });
        applyRoomRoleOverride(sid, rid, { role_id: roleId, allow, deny, created_at: now, updated_at: now });
      } else {
        const userId = selectedOverrideUserId();
        if (!userId) return;
        await putRoomUserPermissionOverride(sid, rid, userId, { allow, deny });
        applyRoomUserOverride(sid, rid, { user_id: userId, allow, deny, created_at: now, updated_at: now });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('roomSettings.overrideSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * How high the viewer may reach when handing out roles: no ceiling for the owner,
   * otherwise their own highest role's position. Roles at or above it are locked, which
   * is what the server enforces too.
   */
  const viewerHighestPosition = createMemo(() => {
    const me = viewerId();
    if (!me) return -1;
    if (props.ownerId === me) return Number.POSITIVE_INFINITY;
    const everyoneId = props.space?.everyone_role_id ?? roles()?.find((r) => r.name === EVERYONE)?.id;
    return memberHighestRolePosition(everyoneId, roles(), viewerMember());
  });
  const roleLockedForViewer = (role: SpaceRole) => role.position >= viewerHighestPosition();
  /** Only the owner may change the owner's roles - but they may, on themselves. */
  const canAssignTo = (userId: string) => userId === viewerId() || userId !== props.ownerId;

  // --- Manage Members: who holds the selected role (Discord's per-role member list) ---
  const roleMemberCount = (roleId: string) =>
    props.members.reduce((n, m) => n + (m.roles?.includes(roleId) ? 1 : 0), 0);
  const roleMembers = createMemo(() => {
    const rid = selectedRoleId();
    return rid ? props.members.filter((m) => m.roles?.includes(rid)) : [];
  });
  const addableMembers = createMemo(() => {
    const rid = selectedRoleId();
    if (!rid) return [];
    const q = memberSearch().trim().toLowerCase();
    return props.members
      .filter((m) => !m.roles?.includes(rid) && canAssignTo(m.id))
      .filter(
        (m) =>
          !q ||
          (m.display_name || '').toLowerCase().includes(q) ||
          (m.username || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  });

  /** Add or remove the selected role from one member, preserving their other custom roles. */
  async function toggleMemberInRole(userId: string, add: boolean) {
    const rid = selectedRoleId();
    const role = currentRole();
    if (!rid || !role || role.name === EVERYONE) return;
    if (!props.canManageRoles || !canAssignTo(userId) || roleLockedForViewer(role)) return;
    const custom = roles()?.filter((r) => r.name !== EVERYONE) ?? [];
    const m = props.members.find((x) => x.id === userId);
    const next = new Set((m?.roles ?? []).filter((id) => custom.some((r) => r.id === id)));
    if (add) next.add(rid);
    else next.delete(rid);
    setBusy(true);
    setErr('');
    try {
      await setMemberSpaceRoles(props.spaceId, userId, [...next]);
      props.onMembersUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('spaceSettings.memberUpdateFailed'));
    } finally {
      setBusy(false);
    }
  }

  // --- Unsaved-changes bar for the Display/Permissions tabs (Discord auto-tracks edits) ---
  const roleDirty = createMemo(() => {
    const r = currentRole();
    if (!r) return false;
    return (
      (r.name !== EVERYONE && roleName().trim() !== r.name && roleName().trim() !== '') ||
      hexToInt(roleColorHex()) !== (r.color ?? 0) ||
      roleHoist() !== !!r.hoist ||
      roleMentionable() !== !!r.mentionable ||
      permMask() !== r.permissions
    );
  });
  function resetRoleEdits() {
    const r = currentRole();
    if (!r) return;
    setRoleName(r.name);
    setRoleColorHex(intToHex(r.color ?? 0));
    setRoleHoist(!!r.hoist);
    setRoleMentionable(!!r.mentionable);
    setPermMask(r.permissions);
  }

  const panelTitle = () => {
    switch (nav()) {
      case 'roles':
        return t('spaceSettings.rolesPerms');
      case 'emojis':
        return t('spaceSettings.emojis');
      default:
        return t(`spaceSettings.pages.${nav()}.title`);
    }
  };
  const panelDescription = () => t(`spaceSettings.descriptions.${nav()}`);

  return (
    <SettingsShell open={props.open} onClose={props.onClose} labelledBy="space-settings-title">
      <SettingsNav<SpaceSettingsSection>
        title={t('space.settings')}
        titleId="space-settings-title"
        groups={navGroups()}
        active={nav()}
        onSelect={(id) => setNav(id)}
      />
      <SettingsPanel title={panelTitle()} description={panelDescription()} onClose={props.onClose}>
        <Show when={err()}>
          <p class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err()}
          </p>
        </Show>

        <Show when={nav() === 'general' && canManageSpace()}>
          <SpaceOverviewPage
            spaceId={props.spaceId}
            space={props.space}
            canManage={canManageSpace()}
            members={props.members}
            viewerId={viewerId()}
            onDeleted={props.onClose}
            onError={setErr}
          />
        </Show>

        <Show when={nav() === 'system' && canManageSpace()}>
          <SpaceSystemPage spaceId={props.spaceId} space={props.space} rooms={spaceRoomList()} canManage={canManageSpace()} onError={setErr} />
        </Show>

        <Show when={nav() === 'members' && canSeeMembers()}>
          <SpaceMembersPage
            spaceId={props.spaceId}
            space={props.space}
            members={props.members}
            roles={roles() ?? []}
            viewerId={viewerId()}
            canKick={canKick()}
            canBan={canBan()}
            canManageRoles={userCanManageRoles()}
            onMembersUpdated={() => props.onMembersUpdated?.()}
            onError={setErr}
          />
        </Show>

        <Show when={nav() === 'invites' && canManageSpace()}>
          <SpaceInvitesPage spaceId={props.spaceId} canManage={canManageSpace()} onError={setErr} />
        </Show>

        <Show when={nav() === 'bans' && canBan()}>
          <SpaceBansPage spaceId={props.spaceId} canBan={canBan()} onError={setErr} />
        </Show>

        <Show when={nav() === 'audit' && canManageSpace()}>
          <SpaceAuditLogPage spaceId={props.spaceId} roles={roles() ?? []} rooms={spaceRoomList()} members={props.members} onError={setErr} />
        </Show>

        <Show when={nav() === 'roles' && userCanManageRoles()}>
          <div class="flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
            {/* Role list */}
            <div class="flex w-full shrink-0 flex-col lg:w-52">
              <h3 class={`mb-2 ${appSectionLabel}`}>{t('profile.roles')}</h3>
              <Show when={!roles()}>
                <p class="text-sm text-muted-foreground">{t('common.loading')}</p>
              </Show>
              <Show when={roles()}>
                <div
                  ref={(el) => (roleListScrollEl = el)}
                  class="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-xl border border-border/80 bg-card/20 p-1 lg:max-h-[min(420px,50vh)]"
                >
                  <For each={roles()!}>
                    {(r) => {
                      const isEveryone = r.name === EVERYONE;
                      const showGrip = () => props.canManageRoles && !isEveryone;
                      const lineBefore = () => dropIndicator()?.overId === r.id && dropIndicator()?.placement === 'before';
                      const lineAfter = () => dropIndicator()?.overId === r.id && dropIndicator()?.placement === 'after';
                      let rowEl: HTMLDivElement | undefined;
                      return (
                        <div class="flex flex-col">
                          <Show when={lineBefore()}>
                            <div
                              class="mb-0.5 h-0.5 shrink-0 rounded-sm bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_70%,transparent)]"
                              aria-hidden="true"
                            />
                          </Show>
                          <div
                            ref={(el) => {
                              rowEl = el;
                              roleRowEls.set(r.id, el);
                            }}
                            role="button"
                            tabIndex={0}
                            class={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              selectedRoleId() === r.id
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            } ${roleDrag.draggingId() === r.id ? 'opacity-40' : ''}`}
                            onClick={() => setSelectedRoleId(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedRoleId(r.id);
                              }
                            }}
                          >
                            <Show
                              when={showGrip()}
                              fallback={<span class="size-4 shrink-0" aria-hidden="true" />}
                            >
                              <span
                                class={`shrink-0 touch-none text-muted-foreground hover:text-foreground ${
                                  busy() ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
                                }`}
                                onPointerDown={(e) => {
                                  if (rowEl) roleDrag.start(e, r.id, rowEl);
                                }}
                                data-tooltip={t('spaceSettings.dragToReorder')}
                                aria-label={t('spaceSettings.reorderRole', { name: r.name })}
                              >
                                <i class="fa-solid fa-grip-vertical" />
                              </span>
                            </Show>

                            <span
                              class="size-3 shrink-0 rounded-full border border-border/40"
                              style={{ 'background-color': intToHex(r.color ?? 0) }}
                            />
                            <span class="truncate">{r.name}</span>
                            <Show when={r.bot_id}>
                              <span
                                class="shrink-0 rounded bg-primary/20 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-primary"
                                data-tooltip={t('spaceSettings.botRoleHint')}
                                aria-label={t('spaceSettings.botRole')}
                              >
                                <i class="fa-solid fa-robot" aria-hidden="true" />
                              </span>
                            </Show>
                            <Show when={!isEveryone}>
                              <span class="ms-auto shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                                <i class="fa-solid fa-user me-0.5 text-[9px]" aria-hidden="true" />
                                {roleMemberCount(r.id)}
                              </span>
                            </Show>
                          </div>
                          <Show when={lineAfter()}>
                            <div
                              class="mt-0.5 h-0.5 shrink-0 rounded-sm bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_70%,transparent)]"
                              aria-hidden="true"
                            />
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
                <Show when={props.canManageRoles}>
                  <form
                    class="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void createRole();
                    }}
                  >
                    <Input
                      class="!h-9 !min-h-9"
                      value={newRoleName()}
                      onInput={(e) => setNewRoleName(e.currentTarget.value)}
                      placeholder={t('spaceSettings.newRoleName')}
                      aria-label={t('spaceSettings.newRoleName')}
                    />
                    <Button type="submit" size="sm" class="h-9 shrink-0" disabled={busy() || !newRoleName().trim()}>
                      <i class="fa-solid fa-plus text-xs" aria-hidden="true" />
                      {t('common.add')}
                    </Button>
                  </form>
                </Show>
              </Show>
            </div>

            {/* Editor */}
            <div class="min-w-0 flex-1 space-y-5">
              <Show when={currentRole()}>
                {(r) => (
                  <>
                    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-4">
                      <div>
                        <h3 class="text-xl font-semibold text-foreground">
                          {t('spaceSettings.editRole')} <span class="text-primary">{r().name}</span>
                        </h3>
                        <p class="text-sm text-muted-foreground">{t('spaceSettings.editRoleHint')}</p>
                      </div>
                      <Show when={props.canManageRoles && r().name !== EVERYONE && !r().bot_id}>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeRole()}
                          disabled={busy()}
                        >
                          <i class="fa-solid fa-trash text-xs" aria-hidden="true" />
                          {t('spaceSettings.deleteRole')}
                        </Button>
                      </Show>
                    </div>

                    <Tabs<RolesSubTab>
                      size="sm"
                      aria-label={t('spaceSettings.roleSection')}
                      value={rolesSubTab()}
                      onChange={(v) => setRolesSubTab(v)}
                      items={[
                        { id: 'display', label: t('spaceSettings.tabDisplay') },
                        { id: 'permissions', label: t('spaceSettings.tabPermissions') },
                        { id: 'members', label: t('spaceSettings.tabMembers') },
                        { id: 'channel', label: t('spaceSettings.tabThisRoom'), disabled: !props.roomId },
                      ]}
                    />

                    <Show when={rolesSubTab() === 'display'}>
                      <div class="space-y-5">
                        <Input
                          label={t('spaceSettings.roleName')}
                          type="text"
                          value={roleName()}
                          disabled={!props.canManageRoles || r().name === EVERYONE}
                          onInput={(e) => setRoleName(e.currentTarget.value)}
                        />
                        <div class="space-y-2">
                          <label class="text-sm font-medium text-foreground" for="space-role-color-hex">
                            {t('spaceSettings.roleColor')}
                          </label>
                          <div class="flex flex-wrap items-center gap-1.5">
                            <For each={ROLE_COLOR_SWATCHES}>
                              {(hex) => (
                                <button
                                  type="button"
                                  disabled={!props.canManageRoles}
                                  aria-label={hex}
                                  onClick={() => setRoleColorHex(hex)}
                                  class="size-7 rounded-md border border-border/40 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                  classList={{ 'ring-2 ring-ring ring-offset-2 ring-offset-background': roleColorHex().toLowerCase() === hex }}
                                  style={{ 'background-color': hex }}
                                />
                              )}
                            </For>
                            <label
                              class="relative flex size-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                              data-tooltip={t('spaceSettings.pickRoleColor')}
                              aria-label={t('spaceSettings.pickRoleColor')}
                            >
                              <i class="fa-solid fa-eye-dropper text-[11px]" aria-hidden="true" />
                              <input
                                type="color"
                                value={roleColorHex()}
                                disabled={!props.canManageRoles}
                                onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                                class="absolute inset-0 cursor-pointer opacity-0"
                              />
                            </label>
                            <input
                              id="space-role-color-hex"
                              type="text"
                              value={roleColorHex()}
                              disabled={!props.canManageRoles}
                              onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                              class={`${inputBaseClass} h-9 w-28 px-3 font-mono`}
                              placeholder="#99aab5"
                            />
                          </div>
                        </div>
                        <div class="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/20 p-4">
                          <div class="flex items-center justify-between gap-4">
                            <div>
                              <p class="text-sm font-medium text-foreground">{t('spaceSettings.hoist')}</p>
                              <p class="text-xs text-muted-foreground">{t('spaceSettings.hoistHint')}</p>
                            </div>
                            <Toggle checked={roleHoist()} disabled={!props.canManageRoles} onChange={setRoleHoist} />
                          </div>
                          <div class="flex items-center justify-between gap-4 border-t border-border/40 pt-4">
                            <div>
                              <p class="text-sm font-medium text-foreground">{t('spaceSettings.mentionable')}</p>
                              <p class="text-xs text-muted-foreground">{t('spaceSettings.mentionableHint')}</p>
                            </div>
                            <Toggle checked={roleMentionable()} disabled={!props.canManageRoles} onChange={setRoleMentionable} />
                          </div>
                        </div>
                      </div>
                    </Show>

                    <Show when={rolesSubTab() === 'permissions'}>
                      <div class="space-y-4">
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <SearchInput
                            size="md"
                            placeholder={t('spaceSettings.searchPerms')}
                            aria-label={t('spaceSettings.searchPerms')}
                            value={permSearch()}
                            onValueChange={setPermSearch}
                            wrapperClass="w-full sm:w-64"
                          />
                          <Show when={props.canManageRoles}>
                            <Button type="button" variant="outline" size="sm" class="h-9 shrink-0" onClick={() => setPermMask(0)}>
                              {t('spaceSettings.clearAll')}
                            </Button>
                          </Show>
                        </div>
                        <div class="space-y-4">
                          <For each={filteredPermGroups()}>
                            {(group) => (
                              <div>
                                <div class="mb-1.5 flex items-center justify-between gap-2 px-1">
                                  <p class={appSectionLabel}>{group.category}</p>
                                  <Show when={props.canManageRoles}>
                                    <Toggle
                                      checked={group.rows.every((row) => hasPerm(permMask(), row.bit))}
                                      onChange={(on) =>
                                        setPermMask((m) => group.rows.reduce((acc, row) => togglePerm(acc, row.bit, on), m))
                                      }
                                    />
                                  </Show>
                                </div>
                                <div class="space-y-1 rounded-xl border border-border/60 bg-card/10 p-2">
                                  <For each={group.rows}>
                                    {(row) => (
                                      <div class="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-muted/20">
                                        <div class="min-w-0 flex-1">
                                          <p class="text-sm font-medium text-foreground">{row.label}</p>
                                          <p class="text-xs text-muted-foreground">{row.description}</p>
                                        </div>
                                        <Toggle
                                          checked={hasPerm(permMask(), row.bit)}
                                          disabled={!props.canManageRoles}
                                          onChange={(on) => setPermMask(togglePerm(permMask(), row.bit, on))}
                                        />
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    <Show when={rolesSubTab() === 'channel'}>
                      <Show when={!props.roomId}>
                        <p class="text-sm text-muted-foreground">{t('spaceSettings.openRoomForOverrides')}</p>
                      </Show>
                      <Show when={props.roomId}>
                        <div class="space-y-4">
                          <p class="text-sm text-muted-foreground">{t('spaceSettings.overridesExplain')}</p>
                          <Tabs
                            size="sm"
                            aria-label={t('roomSettings.overrideTarget')}
                            value={overrideTargetType()}
                            onChange={(v) => setOverrideTargetType(v)}
                            items={[
                              { id: 'role', label: t('roomSettings.roleOverride') },
                              { id: 'user', label: t('roomSettings.memberOverride') },
                            ]}
                          />
                          <Show when={overrideTargetType() === 'user'}>
                            <div class="max-w-md">
                              <Select label={t('spaceSettings.targetMember')} value={selectedOverrideUserId()} onValueChange={setSelectedOverrideUserId}>
                                <option value="">{t('spaceSettings.selectMember')}</option>
                                <For each={props.members}>
                                  {(m) => (
                                    <option value={m.id}>
                                      {m.display_name || m.username}#{m.discriminator}
                                    </option>
                                  )}
                                </For>
                              </Select>
                            </div>
                          </Show>
                          <div class="space-y-1 rounded-xl border border-border/60 bg-card/10 p-2">
                            <For each={ROOM_OVERRIDE_PERM_ROWS}>
                              {(row: PermRow) => (
                                <div class="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-muted/20">
                                  <div class="min-w-0 flex-1">
                                    <p class="text-sm font-medium text-foreground">{row.label}</p>
                                    <p class="text-xs text-muted-foreground">{row.description}</p>
                                  </div>
                                  <TriStateToggle
                                    state={overrideState(row.bit)}
                                    disabled={!props.canManageRoles}
                                    onChange={(next) => setOverrideState(row.bit, next)}
                                  />
                                </div>
                              )}
                            </For>
                          </div>
                          <Show when={props.canManageRoles}>
                            <Button
                              type="button"
                              onClick={() => saveOverride()}
                              loading={busy()}
                              disabled={busy() || (overrideTargetType() === 'user' && !selectedOverrideUserId())}
                            >
                              {t('roomSettings.saveOverride')}
                            </Button>
                          </Show>
                        </div>
                      </Show>
                    </Show>

                    <Show when={rolesSubTab() === 'members'}>
                      <Show
                        when={r().name !== EVERYONE}
                        fallback={<p class="text-sm text-muted-foreground">{t('spaceSettings.everyoneAllMembers')}</p>}
                      >
                        <div class="space-y-5">
                          <div>
                            <p class={`mb-2 ${appSectionLabel}`}>
                              {t('spaceSettings.membersWithRole', { count: roleMembers().length })}
                            </p>
                            <Show
                              when={roleMembers().length}
                              fallback={<p class="text-sm text-muted-foreground">{t('spaceSettings.noMembersWithRole')}</p>}
                            >
                              <div class="space-y-0.5 rounded-xl border border-border/60 bg-card/10 p-2">
                                <For each={roleMembers()}>
                                  {(m) => (
                                    <div class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/20">
                                      <UserCell size="sm" name={m.display_name || m.username} username={m.username} discriminator={m.discriminator} avatar={m.avatar} />
                                      <Show when={props.canManageRoles && canAssignTo(m.id) && !roleLockedForViewer(r()) && !r().bot_id}>
                                        <button
                                          type="button"
                                          class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                                          aria-label={t('spaceSettings.removeFromRole')}
                                          data-tooltip={t('spaceSettings.removeFromRole')}
                                          disabled={busy()}
                                          onClick={() => toggleMemberInRole(m.id, false)}
                                        >
                                          <i class="fa-solid fa-xmark" aria-hidden="true" />
                                        </button>
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                          <Show when={r().bot_id}>
                            <p class="text-sm text-muted-foreground">{t('spaceSettings.botRoleHint')}</p>
                          </Show>
                          <Show when={props.canManageRoles && !roleLockedForViewer(r()) && !r().bot_id}>
                            <div>
                              <p class={`mb-2 ${appSectionLabel}`}>{t('spaceSettings.addMembers')}</p>
                              <SearchInput
                                size="md"
                                placeholder={t('spaceSettings.searchMembers')}
                                aria-label={t('spaceSettings.searchMembers')}
                                value={memberSearch()}
                                onValueChange={setMemberSearch}
                                wrapperClass="w-full"
                              />
                              <Show
                                when={addableMembers().length}
                                fallback={<p class="mt-2 text-sm text-muted-foreground">{t('spaceSettings.noMembersToAdd')}</p>}
                              >
                                <div class="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 bg-card/10 p-2">
                                  <For each={addableMembers()}>
                                    {(m) => (
                                      <button
                                        type="button"
                                        class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted/30 disabled:opacity-50"
                                        disabled={busy()}
                                        onClick={() => toggleMemberInRole(m.id, true)}
                                      >
                                        <UserCell size="sm" name={m.display_name || m.username} username={m.username} discriminator={m.discriminator} avatar={m.avatar} />
                                        <i class="fa-solid fa-plus shrink-0 text-xs text-muted-foreground" aria-hidden="true" />
                                      </button>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </Show>

                    {/* Unsaved-changes bar for Display/Permissions edits (Members / This room save on the spot). */}
                    <Show
                      when={
                        props.canManageRoles &&
                        (rolesSubTab() === 'display' || rolesSubTab() === 'permissions') &&
                        roleDirty()
                      }
                    >
                      <div class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-popover/95 px-4 py-3 shadow-lg backdrop-blur">
                        <p class="text-sm text-muted-foreground">{t('spaceSettings.unsavedRoleChanges')}</p>
                        <div class="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => resetRoleEdits()} disabled={busy()}>
                            {t('spaceSettings.resetRole')}
                          </Button>
                          <Button type="button" size="sm" onClick={() => saveRole()} loading={busy()} disabled={busy()}>
                            {t('common.saveChanges')}
                          </Button>
                        </div>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </div>
          </div>
        </Show>

        <Show when={nav() === 'emojis' && userCanManageEmojis()}>
          <SpaceEmojiSettings spaceId={props.spaceId} />
        </Show>
      </SettingsPanel>
    </SettingsShell>
  );
};
