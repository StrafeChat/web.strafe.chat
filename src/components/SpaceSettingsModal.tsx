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
type RolesSubTab = 'edit' | 'channel' | 'members';

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
  const [rolesSubTab, setRolesSubTab] = createSignal<RolesSubTab>('edit');
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
  const [selectedMemberId, setSelectedMemberId] = createSignal('');
  const [memberRolePick, setMemberRolePick] = createSignal<Set<string>>(new Set());
  const [permSearch, setPermSearch] = createSignal('');
  const [err, setErr] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [dragRoleId, setDragRoleId] = createSignal('');
  const [dropIndicator, setDropIndicator] = createSignal<{
    overId: string;
    placement: 'before' | 'after';
  } | null>(null);
  const [dragging, setDragging] = createSignal(false);

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

  createEffect(() => {
    const uid = selectedMemberId();
    if (!uid || rolesSubTab() !== 'members') return;
    const m = props.members.find((x) => x.id === uid);
    const s = new Set<string>();
    if (m?.roles) for (const r of m.roles) if (r) s.add(r);
    setMemberRolePick(s);
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

  async function saveMemberRoles() {
    const uid = selectedMemberId();
    if (!uid || !canAssignTo(uid) || !props.canManageRoles) return;
    const custom = roles()?.filter((r) => r.name !== EVERYONE) ?? [];
    // Locked roles are sent back exactly as they came so a save never tries to strip one
    // the viewer may not touch (the server would keep it anyway, but this keeps the
    // request honest about what it is asking for).
    const chosen = custom.filter((r) => memberRolePick().has(r.id)).map((r) => r.id);
    setBusy(true);
    setErr('');
    try {
      await setMemberSpaceRoles(props.spaceId, uid, chosen);
      props.onMembersUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('spaceSettings.memberUpdateFailed'));
    } finally {
      setBusy(false);
    }
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
                <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-xl border border-border/80 bg-card/20 p-1 lg:max-h-[min(420px,50vh)]">
                  <For each={roles()!}>
                    {(r) => {
                      const isEveryone = r.name === EVERYONE;
                      const showGrip = props.canManageRoles && !isEveryone;
                      const dragDisabled = busy();
                      const canReceiveDrop = props.canManageRoles;
                      const isDraggingRole = dragRoleId() === r.id;
                      const ind = dropIndicator();
                      const lineBefore = ind?.overId === r.id && ind.placement === 'before';
                      const lineAfter = ind?.overId === r.id && ind.placement === 'after';

                      function updateDropIndicator(e: DragEvent, el: HTMLElement) {
                        const rect = el.getBoundingClientRect();
                        const mid = rect.top + rect.height / 2;
                        const placement = e.clientY < mid ? 'before' : 'after';
                        if (isEveryone) {
                          if (placement === 'before') {
                            setDropIndicator(null);
                            return;
                          }
                          setDropIndicator({ overId: r.id, placement: 'after' });
                          return;
                        }
                        setDropIndicator({ overId: r.id, placement });
                      }

                      return (
                        <div class="flex flex-col">
                          <Show when={lineBefore}>
                            <div
                              class="mb-0.5 h-0.5 shrink-0 rounded-sm bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_70%,transparent)]"
                              aria-hidden="true"
                            />
                          </Show>
                          <div
                            role="button"
                            tabIndex={0}
                            class={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              selectedRoleId() === r.id
                                ? 'bg-muted text-foreground'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            } ${isDraggingRole ? 'opacity-60' : ''}`}
                            onClick={() => {
                              if (dragging()) return;
                              setSelectedRoleId(r.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (!dragging()) setSelectedRoleId(r.id);
                              }
                            }}
                            onDragOver={(e) => {
                              if (!canReceiveDrop || dragDisabled) return;
                              if (!dragRoleId()) return;
                              if (!e.dataTransfer) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              updateDropIndicator(e, e.currentTarget as HTMLElement);
                            }}
                            onDrop={(e) => {
                              if (!canReceiveDrop || dragDisabled) return;
                              const dt = e.dataTransfer;
                              if (!dt) return;
                              e.preventDefault();
                              const from = dt.getData('text/plain') || dragRoleId();
                              const slot = dropIndicator();
                              setDragging(false);
                              setDragRoleId('');
                              setDropIndicator(null);
                              if (!from || !slot) return;
                              void reorderRoles(from, slot.overId, slot.placement);
                            }}
                          >
                            {showGrip ? (
                              <span
                                draggable={!dragDisabled}
                                class={`shrink-0 text-muted-foreground hover:text-foreground ${
                                  dragDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
                                }`}
                                onDragStart={(e) => {
                                  if (!showGrip || dragDisabled) return;
                                  const dt = e.dataTransfer;
                                  if (!dt) return;
                                  dt.effectAllowed = 'move';
                                  dt.setData('text/plain', r.id);
                                  setDragRoleId(r.id);
                                  setDropIndicator(null);
                                  setDragging(true);
                                  e.stopPropagation();
                                }}
                                onDragEnd={() => {
                                  setDragging(false);
                                  setDragRoleId('');
                                  setDropIndicator(null);
                                }}
                                title={t('spaceSettings.dragToReorder')}
                                aria-label={t('spaceSettings.reorderRole', { name: r.name })}
                              >
                                <i class="fa-solid fa-grip-vertical" />
                              </span>
                            ) : (
                              <span class="size-4 shrink-0" aria-hidden="true" />
                            )}

                            <span
                              class="size-3 shrink-0 rounded-full border border-border/40"
                              style={{ 'background-color': intToHex(r.color ?? 0) }}
                            />
                            <span class="truncate">{r.name}</span>
                          </div>
                          <Show when={lineAfter}>
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
                      <Show when={props.canManageRoles && r().name !== EVERYONE}>
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
                        { id: 'edit', label: t('spaceSettings.tabRolePerms') },
                        { id: 'channel', label: t('spaceSettings.tabThisRoom'), disabled: !props.roomId },
                        { id: 'members', label: t('spaceSettings.tabAssign') },
                      ]}
                    />

                    <Show when={rolesSubTab() === 'edit'}>
                      <div class="space-y-5">
                        <div class="grid gap-4 sm:grid-cols-2">
                          <Input
                            label={t('spaceSettings.roleName')}
                            type="text"
                            value={roleName()}
                            disabled={!props.canManageRoles || r().name === EVERYONE}
                            onInput={(e) => setRoleName(e.currentTarget.value)}
                          />
                          <div class="w-full space-y-1.5">
                            <label class="text-sm font-medium text-foreground" for="space-role-color-hex">
                              {t('spaceSettings.roleColor')}
                            </label>
                            <div class="flex gap-2">
                              <input
                                type="color"
                                value={roleColorHex()}
                                disabled={!props.canManageRoles}
                                onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                                aria-label={t('spaceSettings.pickRoleColor')}
                                class="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-input bg-background/80 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <input
                                id="space-role-color-hex"
                                type="text"
                                value={roleColorHex()}
                                disabled={!props.canManageRoles}
                                onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                                class={`${inputBaseClass} h-10 min-w-0 flex-1 px-3 font-mono`}
                                placeholder="#99aab5"
                              />
                            </div>
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
                            <Toggle
                              checked={roleMentionable()}
                              disabled={!props.canManageRoles}
                              onChange={setRoleMentionable}
                            />
                          </div>
                        </div>

                        <div>
                          <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h4 class="text-sm font-semibold text-foreground">{t('spaceSettings.spaceWidePerms')}</h4>
                            <div class="flex items-center gap-2">
                              <SearchInput
                                size="md"
                                placeholder={t('spaceSettings.searchPerms')}
                                aria-label={t('spaceSettings.searchPerms')}
                                value={permSearch()}
                                onValueChange={setPermSearch}
                                wrapperClass="w-full sm:w-56"
                              />
                              <Show when={props.canManageRoles}>
                                <Button type="button" variant="outline" size="sm" class="h-9 shrink-0" onClick={() => setPermMask(0)}>
                                  {t('spaceSettings.clearAll')}
                                </Button>
                              </Show>
                            </div>
                          </div>
                          <div class="space-y-4">
                            <For each={filteredPermGroups()}>
                              {(group) => (
                                <div>
                                  <p class={`mb-1.5 px-1 ${appSectionLabel}`}>{group.category}</p>
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

                        <Show when={props.canManageRoles}>
                          <Button type="button" onClick={() => saveRole()} loading={busy()} disabled={busy()}>
                            {t('common.saveChanges')}
                          </Button>
                        </Show>
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
                      <div class="space-y-4">
                        <p class="text-sm text-muted-foreground">{t('spaceSettings.membersExplain')}</p>
                        <div class="max-w-md">
                          <Select label={t('roomSettings.member')} value={selectedMemberId()} onValueChange={setSelectedMemberId}>
                            <option value="">{t('spaceSettings.selectMember')}</option>
                            {/* The owner is listed when the viewer *is* the owner: giving
                                yourself a role is ordinary, being given one by someone
                                else is not. */}
                            <For each={props.members.filter((m) => canAssignTo(m.id))}>
                              {(m) => (
                                <option value={m.id}>
                                  {m.display_name || m.username}#{m.discriminator}
                                </option>
                              )}
                            </For>
                          </Select>
                        </div>
                        <Show when={selectedMemberId()}>
                          <div class="space-y-1 rounded-xl border border-border/60 bg-card/10 p-2">
                            <For each={roles()?.filter((x) => x.name !== EVERYONE) ?? []}>
                              {(role) => (
                                <div class="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/20">
                                  <span class="flex min-w-0 items-center gap-2 text-sm text-foreground">
                                    <span
                                      class="size-2.5 shrink-0 rounded-full border border-border/40"
                                      style={{ 'background-color': intToHex(role.color ?? 0) }}
                                    />
                                    <span class="truncate">{role.name}</span>
                                    <Show when={roleLockedForViewer(role)}>
                                      <i
                                        class="fa-solid fa-lock text-[10px] text-muted-foreground"
                                        title={t('spaceSettings.members.roleLocked')}
                                        aria-hidden="true"
                                      />
                                    </Show>
                                  </span>
                                  <Toggle
                                    checked={memberRolePick().has(role.id)}
                                    disabled={!props.canManageRoles || roleLockedForViewer(role)}
                                    onChange={(on) => {
                                      setMemberRolePick((prev) => {
                                        const next = new Set(prev);
                                        if (on) next.add(role.id);
                                        else next.delete(role.id);
                                        return next;
                                      });
                                    }}
                                  />
                                </div>
                              )}
                            </For>
                          </div>
                          <Show when={props.canManageRoles}>
                            <Button type="button" onClick={() => saveMemberRoles()} loading={busy()} disabled={busy()}>
                              {t('spaceSettings.saveMemberRoles')}
                            </Button>
                          </Show>
                        </Show>
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
