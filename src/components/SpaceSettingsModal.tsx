import type { Component } from 'solid-js';
import { userOptionLabel } from '../stores/instance';
import { resolveProfile } from '../lib/spaceProfile';
import { batch, createSignal, createEffect, createMemo, For, Show, untrack } from 'solid-js';
import {
  createSpaceRole,
  deleteSpaceRole,
  patchSpaceRole,
  putRoomPermissionOverride,
  putRoomUserPermissionOverride,
  saveSpaceRoleOrder,
  setMemberSpaceRoles,
  type Space,
  type SpaceMember,
  type SpaceRole,
} from '../api/spaces';
import {
  canChangeMemberRole,
  hasPerm,
  memberCanBanMembers,
  memberCanKickMembers,
  memberCanManageEmojis,
  memberCanManageNicknames,
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
  mergeSpaceRoles,
  removeSpaceRole,
  roomOverrides,
  spaceRoles,
  spaces,
  upsertSpaceRole,
} from '../stores/spaces';
import { customRolesHighestFirst, planRoleOrder } from '../lib/roleOrder';
import { translateRoleApiError } from '../lib/formatApiError';
import { auth } from '../stores/auth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { SearchInput } from './ui/SearchInput';
import { MenuSelect } from './ui/MenuSelect';
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
  SpaceDiscoverPage,
  SpaceInvitesPage,
  SpaceMembersPage,
  SpaceOverviewPage,
  SpaceSystemPage,
  SpaceModerationPage,
} from './settings/space';
import { appSectionLabel } from '../theme/appChrome';
import { confirmDialog } from '../stores/confirmDialog';
import { t } from '../i18n';
import { ColorPicker } from './ui/ColorPicker';
const EVERYONE = '@everyone';

/** A member as this space shows them - nickname and space avatar when set - with the handle. */
const MemberCell: Component<{ m: SpaceMember }> = (props) => {
  const r = () => resolveProfile(props.m, props.m, props.m.username);
  return <UserCell size="sm" name={r().name} bot={props.m.bot} username={props.m.username} avatar={r().avatar} />;
};

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

type SpaceSettingsSection = 'general' | 'system' | 'discover' | 'roles' | 'emojis' | 'moderation' | 'members' | 'invites' | 'bans' | 'audit';
type RolesSubTab = 'display' | 'permissions' | 'members' | 'channel';
/** The parts of a role the Display/Permissions draft edits. */
type RoleFields = Pick<SpaceRole, 'id' | 'name' | 'color' | 'hoist' | 'mentionable' | 'permissions'>;

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
  // Manage Nicknames is moderation too: the Members page is where its holder changes
  // nicknames and resets space profiles.
  const canManageNicknames = createMemo(() => memberCanManageNicknames(props.space, roles(), viewerMember(), viewerId()));
  const canSeeMembers = createMemo(
    () => canManageSpace() || userCanManageRoles() || canKick() || canBan() || canManageNicknames()
  );

  // --- The role hierarchy as the viewer may touch it ---
  const everyoneRoleId = createMemo(
    () => props.space?.everyone_role_id ?? roles()?.find((r) => r.name === EVERYONE)?.id
  );
  const isEveryoneRole = (role: SpaceRole) => role.id === everyoneRoleId() || role.name === EVERYONE;
  /** Custom roles highest first, the way Discord draws the hierarchy (the store keeps them lowest first). */
  const customRoles = createMemo(() => customRolesHighestFirst(roles() ?? [], everyoneRoleId()));

  /**
   * How high the viewer may reach: no ceiling for the owner, otherwise their own highest role's
   * position. Roles at or above it can be neither edited, moved, given out nor taken away - what
   * the server enforces too. Administrator does not lift it; only ownership does.
   */
  const viewerHighestPosition = createMemo(() => {
    const me = viewerId();
    if (!me) return -1;
    if (props.ownerId === me) return Number.POSITIVE_INFINITY;
    return memberHighestRolePosition(everyoneRoleId(), roles(), viewerMember());
  });
  /** @everyone takes permission edits from anyone with Manage Roles (it sits under every rank);
   * any other role only from someone ranked above it. */
  const roleEditable = (role: SpaceRole) =>
    userCanManageRoles() && (isEveryoneRole(role) || role.position < viewerHighestPosition());
  /** The custom roles the viewer may drag: those below their own highest (owner: all of them). */
  const roleMovable = (role: SpaceRole) =>
    userCanManageRoles() && !isEveryoneRole(role) && role.position < viewerHighestPosition();

  /** While a new order is being saved, the order it asks for - drawn instead of the store's, so a
   * dropped row stays where it was dropped instead of jumping back until the answer arrives. */
  const [pendingRoleOrder, setPendingRoleOrder] = createSignal<string[] | null>(null);
  const shownCustomRoles = createMemo(() => {
    const list = customRoles();
    const order = pendingRoleOrder();
    if (!order) return list;
    const byId = new Map(list.map((r) => [r.id, r]));
    const shown = order.map((id) => byId.get(id)).filter((r): r is SpaceRole => !!r);
    // A role someone created meanwhile is new, and new roles start at the bottom.
    return [...shown, ...list.filter((r) => !order.includes(r.id))];
  });
  /** The role list: highest first, @everyone pinned at the bottom (Discord's layout). */
  const roleRows = createMemo((): SpaceRole[] => {
    const everyone = roles()?.find(isEveryoneRole);
    return everyone ? [...shownCustomRoles(), everyone] : shownCustomRoles();
  });

  /** A failed role write, in the viewer's language. */
  const roleErrorText = (e: unknown, fallbackKey: string) => translateRoleApiError(e, t).join(' ') || t(fallbackKey);

  const allowed = (id: SpaceSettingsSection): boolean => {
    switch (id) {
      case 'general':
      case 'system':
      case 'discover':
      case 'moderation':
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
    if (allowed('discover')) general.push({ id: 'discover', label: t('spaceSettings.pages.discover.title'), icon: 'fa-compass' });
    if (allowed('roles')) general.push({ id: 'roles', label: t('spaceSettings.rolesPerms'), icon: 'fa-shield-halved' });
    if (allowed('emojis')) general.push({ id: 'emojis', label: t('spaceSettings.emojis'), icon: 'fa-face-smile' });
    const moderation: SettingsNavItemDef<SpaceSettingsSection>[] = [];
    if (allowed('moderation')) moderation.push({ id: 'moderation', label: t('spaceSettings.pages.moderation.title'), icon: 'fa-shield' });
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
    const list = roleRows();
    if (!list.length) return;
    const cur = selectedRoleId();
    if (!cur || !list.some((r) => r.id === cur)) {
      // The highest role the viewer can work on, as the list runs top down.
      setSelectedRoleId((list.find(roleEditable) ?? list[0]!).id);
    }
  });

  /** True when the role draft (name, colour, toggles, permissions) differs from `r`. */
  function roleDraftDiffers(r: RoleFields): boolean {
    return (
      (r.name !== EVERYONE && roleName().trim() !== r.name && roleName().trim() !== '') ||
      hexToInt(roleColorHex()) !== (r.color ?? 0) ||
      roleHoist() !== !!r.hoist ||
      roleMentionable() !== !!r.mentionable ||
      permMask() !== r.permissions
    );
  }

  /** The stored values the role draft was last seeded from. */
  let seededRole: RoleFields | undefined;
  createEffect(() => {
    const id = selectedRoleId();
    const list = roles();
    if (!id || !list) return;
    const r = list.find((x) => x.id === id);
    if (!r) return;
    const next: RoleFields = {
      id: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions,
    };
    const prev = seededRole;
    seededRole = next;
    // Any role change in the space (another admin's edit, a new role, a reorder) hands us a
    // new roles list. Picking a role always reseeds; an update to the same role only reseeds
    // when nothing is unsaved against what was seeded before, or the edits would be wiped.
    if (prev && prev.id === next.id && untrack(() => roleDraftDiffers(prev))) return;
    setRoleName(next.name);
    setRoleColorHex(intToHex(next.color ?? 0));
    setRoleHoist(!!next.hoist);
    setRoleMentionable(!!next.mentionable);
    setPermMask(next.permissions);
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
    if (!rid || !r || !roleEditable(r)) return;
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
      // Show what the server stored: the seeding effect keeps a draft that differed from the
      // role before the save, which this one did by definition.
      if (selectedRoleId() === rid) resetRoleEdits();
    } catch (e) {
      setErr(roleErrorText(e, 'common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    const n = newRoleName().trim();
    if (!n || !userCanManageRoles()) return;
    setBusy(true);
    setErr('');
    try {
      // Discord starts a new role as a copy of @everyone's current permissions, not empty -
      // toggles read as "on" for whatever a member can already do, off only for the extras
      // this role is meant to grant.
      const everyonePerms = roles()?.find(isEveryoneRole)?.permissions ?? 0;
      const role = await createSpaceRole(props.spaceId, { name: n, permissions: everyonePerms });
      // It goes in at the bottom, just above @everyone (the roles it moved up arrive as one
      // SPACE_UPDATE); open it, since that is where the person goes next.
      upsertSpaceRole(props.spaceId, role);
      setSelectedRoleId(role.id);
      setNewRoleName('');
    } catch (e) {
      setErr(roleErrorText(e, 'spaceSettings.createRoleFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeRole() {
    const rid = selectedRoleId();
    const r = roles()?.find((x) => x.id === rid);
    if (!rid || !r || isEveryoneRole(r) || r.bot_id || !roleEditable(r)) return;
    // Asked first, like deleting a room or a section: the role comes off everyone who has it,
    // with what it granted, and there is no undo.
    const ok = await confirmDialog({
      title: t('spaceSettings.deleteRole'),
      body: t('spaceSettings.deleteRoleConfirm', { name: r.name }),
      confirmLabel: t('spaceSettings.deleteRole'),
      tone: 'danger',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      await deleteSpaceRole(props.spaceId, rid);
      removeSpaceRole(props.spaceId, rid);
      setSelectedRoleId('');
    } catch (e) {
      setErr(roleErrorText(e, 'common.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Move a role to the gap before/after another, in the highest-first list. Only roles below the
   * viewer move, and only among themselves: they are the bottom of the list (every role under
   * the viewer's highest), so a drop above them lands at their top, under the viewer's own rank.
   * The new order is saved by swapping the positions those roles already hold (lib/roleOrder),
   * so no role at or above the viewer is written and no two roles end up sharing a position.
   */
  async function reorderRoles(dragId: string, overId: string, placement: 'before' | 'after') {
    if (!userCanManageRoles() || busy() || !dragId || !overId || dragId === overId) return;
    const order = customRoles();
    const moved = order.find((r) => r.id === dragId);
    if (!moved || !roleMovable(moved)) return;

    const next = order.filter((r) => r.id !== dragId);
    const ti = next.findIndex((r) => r.id === overId);
    if (ti < 0) return;
    const firstMovable = next.findIndex(roleMovable);
    const top = firstMovable < 0 ? next.length : firstMovable;
    next.splice(Math.max(top, placement === 'before' ? ti : ti + 1), 0, moved);
    if (next.every((r, i) => r.id === order[i]!.id)) return;

    const movable = new Set(order.filter(roleMovable).map((r) => r.id));
    const plan = planRoleOrder(next, movable);
    // Only when legacy ties leave more roles than free places under the viewer's own; the server
    // would refuse it, so say so before anything is written.
    if (plan.positions.some((p) => p.position >= viewerHighestPosition())) {
      setErr(t('errors.api.roleHierarchyRole'));
      return;
    }

    setPendingRoleOrder(next.map((r) => r.id));
    setBusy(true);
    setErr('');
    try {
      const saved = await saveSpaceRoleOrder(props.spaceId, plan);
      const sid = props.spaceId;
      // Merged, not swapped in: role events from the gateway can land before this answer, and
      // replacing the list with it would undo a role created, deleted or edited meanwhile.
      if (saved.complete) mergeSpaceRoles(sid, saved.roles);
      else batch(() => saved.roles.forEach((role) => upsertSpaceRole(sid, role)));
    } catch (e) {
      setErr(roleErrorText(e, 'spaceSettings.reorderFailed'));
    } finally {
      setPendingRoleOrder(null);
      setBusy(false);
    }
  }

  // --- Pointer-drag reordering for the role list (Discord-style, replaces native HTML5 drag) ---
  let roleListScrollEl: HTMLDivElement | undefined;
  const roleRowEls = new Map<string, HTMLElement>();

  /**
   * The before/after gap the cursor is over among the rows the viewer may move - the bottom of the
   * list, above @everyone. Over a locked row (at or above the viewer) the drop clamps to the top
   * of the movable rows, over @everyone to their bottom: nothing lands at or above the viewer.
   */
  function roleDropSlotAt(clientY: number): { overId: string; placement: 'before' | 'after' } | null {
    const movable = shownCustomRoles().filter(roleMovable);
    for (const role of movable) {
      const el = roleRowEls.get(role.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return { overId: role.id, placement: 'before' };
      if (clientY <= rect.bottom) return { overId: role.id, placement: 'after' };
    }
    const last = movable[movable.length - 1];
    return last ? { overId: last.id, placement: 'after' } : null;
  }

  const roleDrag = createPointerDrag({
    enabled: () => userCanManageRoles() && !busy(),
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
    if (!rid || !userCanManageRoles()) return;
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

  /** Whether the viewer may give this role to members and take it back - any member, the owner and
   * people ranked above the viewer included (Discord: only the role's position counts). */
  const roleAssignable = (role: SpaceRole) => userCanManageRoles() && canChangeMemberRole(role, viewerHighestPosition());

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
      .filter((m) => !m.roles?.includes(rid))
      .filter(
        (m) =>
          !q ||
          (m.nick || '').toLowerCase().includes(q) ||
          (m.display_name || '').toLowerCase().includes(q) ||
          (m.username || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  });

  /** Add or remove the selected role from one member, preserving their other custom roles. The
   * full-list PUT rather than the single-role one, which instances from before October 2026 lack;
   * the server keeps any role above the viewer whatever the list says. */
  async function toggleMemberInRole(userId: string, add: boolean) {
    const rid = selectedRoleId();
    const role = currentRole();
    if (!rid || !role || !roleAssignable(role)) return;
    const customIds = new Set(customRoles().map((r) => r.id));
    const m = props.members.find((x) => x.id === userId);
    const next = new Set((m?.roles ?? []).filter((id) => customIds.has(id)));
    if (add) next.add(rid);
    else next.delete(rid);
    setBusy(true);
    setErr('');
    try {
      await setMemberSpaceRoles(props.spaceId, userId, [...next]);
      props.onMembersUpdated?.();
    } catch (e) {
      setErr(roleErrorText(e, 'spaceSettings.memberUpdateFailed'));
    } finally {
      setBusy(false);
    }
  }

  // --- Unsaved-changes bar for the Display/Permissions tabs (Discord auto-tracks edits) ---
  const roleDirty = createMemo(() => {
    const r = currentRole();
    return !!r && roleDraftDiffers(r);
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
        onClose={props.onClose}
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
            rooms={spaceRoomList()}
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

        <Show when={nav() === 'moderation' && canManageSpace()}>
          <SpaceModerationPage spaceId={props.spaceId} space={props.space} canManage={canManageSpace()} onError={setErr} />
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

        <Show when={nav() === 'discover' && canManageSpace() && props.space}>
          {(space) => <SpaceDiscoverPage spaceId={props.spaceId} space={space()} onError={setErr} />}
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
                  <For each={roleRows()}>
                    {(r) => {
                      const isEveryone = isEveryoneRole(r);
                      const movable = () => roleMovable(r);
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
                            {/* A grip on the rows the viewer may move; a lock on the custom roles at or
                                above their own highest (which are not drop targets either);
                                nothing on @everyone, which always stays at the bottom. */}
                            <Show
                              when={movable()}
                              fallback={
                                <Show when={!isEveryone} fallback={<span class="size-4 shrink-0" aria-hidden="true" />}>
                                  <span
                                    role="img"
                                    class="flex size-4 shrink-0 items-center justify-center text-muted-foreground/70"
                                    data-tooltip={t('spaceSettings.members.roleLocked')}
                                    aria-label={t('spaceSettings.members.roleLocked')}
                                  >
                                    <i class="fa-solid fa-lock text-[10px]" aria-hidden="true" />
                                  </span>
                                </Show>
                              }
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
                <Show when={userCanManageRoles()}>
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
                        <Show when={r().bot_id}>
                          <p class="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                            <i class="fa-solid fa-robot mt-1 shrink-0 text-xs text-primary" aria-hidden="true" />
                            <span>{t('spaceSettings.botRoleOrderHint')}</span>
                          </p>
                        </Show>
                        <Show when={!roleEditable(r())}>
                          <p class="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                            <i class="fa-solid fa-lock mt-1 shrink-0 text-xs" aria-hidden="true" />
                            <span>{t('spaceSettings.members.roleLocked')}</span>
                          </p>
                        </Show>
                      </div>
                      <Show when={roleEditable(r()) && !isEveryoneRole(r()) && !r().bot_id}>
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
                          disabled={!roleEditable(r()) || isEveryoneRole(r())}
                          onInput={(e) => setRoleName(e.currentTarget.value)}
                        />
                        <div class="space-y-2">
                          <ColorPicker
                            label={t('spaceSettings.roleColor')}
                            value={roleColorHex()}
                            onChange={setRoleColorHex}
                            disabled={!roleEditable(r())}
                          />
                        </div>
                        <div class="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/20 p-4">
                          <div class="flex items-center justify-between gap-4">
                            <div>
                              <p class="text-sm font-medium text-foreground">{t('spaceSettings.hoist')}</p>
                              <p class="text-xs text-muted-foreground">{t('spaceSettings.hoistHint')}</p>
                            </div>
                            <Toggle
                              checked={roleHoist()}
                              disabled={!roleEditable(r())}
                              label={t('spaceSettings.hoist')}
                              onChange={setRoleHoist}
                            />
                          </div>
                          <div class="flex items-center justify-between gap-4 border-t border-border/40 pt-4">
                            <div>
                              <p class="text-sm font-medium text-foreground">{t('spaceSettings.mentionable')}</p>
                              <p class="text-xs text-muted-foreground">{t('spaceSettings.mentionableHint')}</p>
                            </div>
                            <Toggle
                              checked={roleMentionable()}
                              disabled={!roleEditable(r())}
                              label={t('spaceSettings.mentionable')}
                              onChange={setRoleMentionable}
                            />
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
                          <Show when={roleEditable(r())}>
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
                                  <Show when={roleEditable(r())}>
                                    <Toggle
                                      checked={group.rows.every((row) => hasPerm(permMask(), row.bit))}
                                      label={group.category}
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
                                          disabled={!roleEditable(r())}
                                          label={row.label}
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
                              <MenuSelect
                                label={t('spaceSettings.targetMember')}
                                value={selectedOverrideUserId()}
                                options={[
                                  { value: '', label: t('spaceSettings.selectMember') },
                                  ...props.members.map((m) => ({
                                    value: m.id,
                                    label: userOptionLabel({ username: m.username, display_name: resolveProfile(m, m, m.username).name }),
                                  })),
                                ]}
                                onValueChange={setSelectedOverrideUserId}
                              />
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
                                    disabled={!userCanManageRoles()}
                                    onChange={(next) => setOverrideState(row.bit, next)}
                                  />
                                </div>
                              )}
                            </For>
                          </div>
                          <Show when={userCanManageRoles()}>
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
                        when={!isEveryoneRole(r())}
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
                                      <MemberCell m={m} />
                                      <Show when={roleAssignable(r())}>
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
                          <Show when={roleAssignable(r())}>
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
                                        <MemberCell m={m} />
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
                        roleEditable(r()) &&
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
