import type { Component } from 'solid-js';
import { createResource, createSignal, createEffect, createMemo, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  createSpaceRole,
  deleteSpaceRole,
  listRoomPermissionOverrides,
  listSpaceRoles,
  patchSpaceRole,
  putRoomPermissionOverride,
  setMemberSpaceRoles,
  type Space,
  type SpaceMember,
} from '../api/spaces';
import { hasPerm, SPACE_ROLE_PERM_ROWS, togglePerm } from '../lib/spacePermissions';
import { spaceSync } from '../stores/spaceSync';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const EVERYONE = '@everyone';

/** Discord-style role color (24-bit RGB). */
function intToHex(c: number): string {
  const u = c >>> 0;
  return `#${(u & 0xffffff).toString(16).padStart(6, '0')}`;
}
function hexToInt(h: string): number {
  const s = h.trim().replace(/^#/, '');
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? 0 : n & 0xffffff;
}

function DiscordToggle(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      disabled={props.disabled}
      class={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        props.checked ? 'bg-[#5865F2]' : 'bg-muted'
      } ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      onClick={() => {
        if (!props.disabled) props.onChange(!props.checked);
      }}
    >
      <span
        class={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${
          props.checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

type SettingsNav = 'general' | 'roles';

interface SpaceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  space: Space | undefined;
  spaceId: string;
  roomId?: string | null;
  members: SpaceMember[];
  canManage: boolean;
  ownerId: string;
  onMembersUpdated?: () => void;
}

export const SpaceSettingsModal: Component<SpaceSettingsModalProps> = (props) => {
  const [nav, setNav] = createSignal<SettingsNav>('general');
  const [rolesSubTab, setRolesSubTab] = createSignal<'edit' | 'channel' | 'members'>('edit');
  const [selectedRoleId, setSelectedRoleId] = createSignal('');
  const [permMask, setPermMask] = createSignal(0);
  const [roleName, setRoleName] = createSignal('');
  const [roleColorHex, setRoleColorHex] = createSignal('#99aab5');
  const [roleHoist, setRoleHoist] = createSignal(false);
  const [roleMentionable, setRoleMentionable] = createSignal(false);
  const [newRoleName, setNewRoleName] = createSignal('');
  const [allowStr, setAllowStr] = createSignal('0');
  const [denyStr, setDenyStr] = createSignal('0');
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

  const [roles, { refetch: refetchRoles }] = createResource(
    () =>
      props.open
        ? ([props.spaceId, spaceSync.rolesRevision[props.spaceId] ?? 0] as const)
        : null,
    async ([sid]) => {
      setErr('');
      return listSpaceRoles(sid);
    }
  );

  const [overrides, { refetch: refetchOverrides }] = createResource(
    () => {
      if (!props.open || !props.roomId || nav() !== 'roles' || rolesSubTab() !== 'channel') {
        return null;
      }
      const sid = props.spaceId;
      const rid = props.roomId;
      const k = `${sid}:${rid}`;
      return [sid, rid, spaceSync.roomOverridesRevision[k] ?? 0] as const;
    },
    async ([sid, rid]) => listRoomPermissionOverrides(sid, rid)
  );

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
    const id = selectedRoleId();
    const ovs = overrides();
    if (id === '' || ovs === undefined) return;
    const o = ovs.find((x) => x.role_id === id);
    setAllowStr(o ? String(o.allow) : '0');
    setDenyStr(o ? String(o.deny) : '0');
  });

  createEffect(() => {
    const uid = selectedMemberId();
    if (!uid || rolesSubTab() !== 'members') return;
    const m = props.members.find((x) => x.id === uid);
    const s = new Set<string>();
    if (m?.roles) for (const r of m.roles) if (r) s.add(r);
    setMemberRolePick(s);
  });

  const currentRole = createMemo(() => {
    const list = roles();
    const id = selectedRoleId();
    if (!list || !id) return undefined;
    return list.find((r) => r.id === id);
  });

  const filteredPermRows = createMemo(() => {
    const q = permSearch().trim().toLowerCase();
    if (!q) return SPACE_ROLE_PERM_ROWS;
    return SPACE_ROLE_PERM_ROWS.filter(
      (row) =>
        row.label.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
    );
  });

  async function saveRole() {
    const sid = props.spaceId;
    const rid = selectedRoleId();
    const r = currentRole();
    if (!rid || !r || !props.canManage) return;
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
      await patchSpaceRole(sid, rid, body);
      await refetchRoles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    const n = newRoleName().trim();
    if (!n || !props.canManage) return;
    setBusy(true);
    setErr('');
    try {
      await createSpaceRole(props.spaceId, { name: n, permissions: 0 });
      setNewRoleName('');
      await refetchRoles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create role');
    } finally {
      setBusy(false);
    }
  }

  async function removeRole() {
    const rid = selectedRoleId();
    const r = roles()?.find((x) => x.id === rid);
    if (!rid || !r || r.name === EVERYONE || !props.canManage) return;
    setBusy(true);
    setErr('');
    try {
      await deleteSpaceRole(props.spaceId, rid);
      await refetchRoles();
      setSelectedRoleId('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  async function reorderRoles(dragId: string, overId: string, placement: 'before' | 'after') {
    if (!props.canManage || busy()) return;
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
        await patchSpaceRole(props.spaceId, next[i]!.id, { position: i + 1 });
      }
      await refetchRoles();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to re-order roles');
    } finally {
      setBusy(false);
    }
  }

  async function saveOverride() {
    const sid = props.spaceId;
    const rid = props.roomId;
    const roleId = selectedRoleId();
    if (!rid || !roleId || !props.canManage) return;
    const allow = Number.parseInt(allowStr(), 10);
    const deny = Number.parseInt(denyStr(), 10);
    if (Number.isNaN(allow) || Number.isNaN(deny)) {
      setErr('Allow and deny must be integers');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await putRoomPermissionOverride(sid, rid, roleId, { allow, deny });
      await refetchOverrides();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save override');
    } finally {
      setBusy(false);
    }
  }

  async function saveMemberRoles() {
    const uid = selectedMemberId();
    if (!uid || uid === props.ownerId || !props.canManage) return;
    const custom = roles()?.filter((r) => r.name !== EVERYONE) ?? [];
    const chosen = custom.filter((r) => memberRolePick().has(r.id)).map((r) => r.id);
    setBusy(true);
    setErr('');
    try {
      await setMemberSpaceRoles(props.spaceId, uid, chosen);
      props.onMembersUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update member');
    } finally {
      setBusy(false);
    }
  }

  const NavBtn: Component<{ id: SettingsNav; icon: string; label: string; disabled?: boolean }> = (p) => (
    <button
      type="button"
      disabled={p.disabled}
      class={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors ${
        nav() === p.id
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      } ${p.disabled ? 'pointer-events-none opacity-40' : ''}`}
      onClick={() => setNav(p.id)}
    >
      <i class={`fa-solid ${p.icon} w-5 shrink-0 text-center opacity-80`} />
      <span class="truncate">{p.label}</span>
    </button>
  );

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <div
          class="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6"
          data-modal
          onClick={(e) => {
            if (e.target === e.currentTarget) props.onClose();
          }}
        >
          <div
            class="flex h-[min(92dvh,760px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-[hsl(0_0%_7%)] shadow-2xl md:flex-row"
            role="dialog"
            aria-modal="true"
            aria-labelledby="space-settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar */}
            <aside class="flex max-h-[40vh] shrink-0 flex-col border-b border-border md:max-h-none md:w-56 md:border-b-0 md:border-r md:border-border/80 md:bg-card/30">
              <div class="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-3 md:border-0 md:px-4">
                <h2 id="space-settings-title" class="truncate text-lg font-semibold text-foreground">
                  Space settings
                </h2>
                <button
                  type="button"
                  class="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close settings"
                  onClick={() => props.onClose()}
                >
                  <i class="fa-solid fa-xmark text-lg" />
                </button>
              </div>
              <nav class="flex flex-1 flex-row gap-0.5 overflow-x-auto px-2 py-2 md:flex-col md:overflow-y-auto md:px-2 md:py-3">
                <p class="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
                  Space
                </p>
                <NavBtn id="general" icon="fa-sliders" label="General" />
                <NavBtn id="roles" icon="fa-shield-halved" label="Roles & permissions" />
              </nav>
            </aside>

            {/* Main */}
            <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-background/40">
              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-8 md:py-6">
                {err() && (
                  <p class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {err()}
                  </p>
                )}

                <Show when={nav() === 'general'}>
                  <div class="max-w-xl space-y-4">
                    <div>
                      <h3 class="text-xl font-semibold text-foreground">General</h3>
                      <p class="text-sm text-muted-foreground">Overview of this space.</p>
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</label>
                      <p class="text-sm text-foreground">{props.space?.name ?? '—'}</p>
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                      <p class="text-sm text-foreground whitespace-pre-wrap">
                        {props.space?.description?.trim() ? props.space.description : 'No description'}
                      </p>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Invite links and advanced space options will appear here later.
                    </p>
                  </div>
                </Show>

                <Show when={nav() === 'roles'}>
                  <div class="flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
                    {/* Role list */}
                    <div class="flex w-full shrink-0 flex-col lg:w-52">
                      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Roles
                      </h3>
                      <Show when={roles.loading}>
                        <p class="text-sm text-muted-foreground">Loading…</p>
                      </Show>
                      <Show when={!roles.loading && roles()}>
                        <div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border/80 bg-card/20 p-1 lg:max-h-[min(420px,50vh)]">
                          <For each={roles()!}>
                            {(r) => {
                              const isEveryone = r.name === EVERYONE;
                              const showGrip = props.canManage && !isEveryone;
                              const dragDisabled = busy();
                              const canReceiveDrop = props.canManage;
                              const isDraggingRole = dragRoleId() === r.id;
                              const ind = dropIndicator();
                              const lineBefore =
                                ind?.overId === r.id && ind.placement === 'before';
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
                                      class="mb-0.5 h-0.5 shrink-0 rounded-full bg-[#5865F2] shadow-[0_0_8px_rgba(88,101,242,0.7)]"
                                      aria-hidden="true"
                                    />
                                  </Show>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    class={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
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
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = 'move';
                                      updateDropIndicator(e, e.currentTarget as HTMLElement);
                                    }}
                                    onDrop={(e) => {
                                      if (!canReceiveDrop || dragDisabled) return;
                                      e.preventDefault();
                                      const from =
                                        e.dataTransfer.getData('text/plain') || dragRoleId();
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
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.dataTransfer.setData('text/plain', r.id);
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
                                        title="Drag to re-order"
                                        aria-label={`Reorder role ${r.name}`}
                                      >
                                        <i class="fa-solid fa-grip-vertical" />
                                      </span>
                                    ) : (
                                      <span class="size-4 shrink-0" aria-hidden="true" />
                                    )}

                                    <span
                                      class="size-3 shrink-0 rounded-full border border-white/10"
                                      style={{ 'background-color': intToHex(r.color ?? 0) }}
                                    />
                                    <span class="truncate">{r.name}</span>
                                  </div>
                                  <Show when={lineAfter}>
                                    <div
                                      class="mt-0.5 h-0.5 shrink-0 rounded-full bg-[#5865F2] shadow-[0_0_8px_rgba(88,101,242,0.7)]"
                                      aria-hidden="true"
                                    />
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                        <Show when={props.canManage}>
                          <div class="mt-2 flex gap-2">
                            <Input
                              class="!min-h-9 flex-1"
                              value={newRoleName()}
                              onInput={(e) => setNewRoleName(e.currentTarget.value)}
                              placeholder="New role name"
                            />
                            <Button
                              type="button"
                              size="sm"
                              class="shrink-0"
                              onClick={() => createRole()}
                              disabled={busy() || !newRoleName().trim()}
                            >
                              <i class="fa-solid fa-plus mr-1" />
                              Add
                            </Button>
                          </div>
                        </Show>
                      </Show>
                    </div>

                    {/* Editor */}
                    <div class="min-w-0 flex-1 space-y-6">
                      <Show when={currentRole()}>
                        {(r) => (
                          <>
                            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-4">
                              <div>
                                <h3 class="text-xl font-semibold text-foreground">
                                  Edit <span class="text-[#5865F2]">{r().name}</span>
                                </h3>
                                <p class="text-sm text-muted-foreground">Configure role settings and permissions.</p>
                              </div>
                              <Show when={props.canManage && r().name !== EVERYONE}>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  class="gap-2"
                                  onClick={() => removeRole()}
                                  disabled={busy()}
                                >
                                  <i class="fa-solid fa-trash" />
                                  Delete role
                                </Button>
                              </Show>
                            </div>

                            <div class="flex flex-wrap gap-2 border-b border-border/60 pb-4">
                              <button
                                type="button"
                                class={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  rolesSubTab() === 'edit'
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                                onClick={() => setRolesSubTab('edit')}
                              >
                                Role & permissions
                              </button>
                              <button
                                type="button"
                                disabled={!props.roomId}
                                class={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  rolesSubTab() === 'channel'
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:bg-muted/50'
                                } ${!props.roomId ? 'opacity-40' : ''}`}
                                onClick={() => setRolesSubTab('channel')}
                              >
                                This channel
                              </button>
                              <button
                                type="button"
                                class={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                  rolesSubTab() === 'members'
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                                onClick={() => setRolesSubTab('members')}
                              >
                                Assign to members
                              </button>
                            </div>

                            <Show when={rolesSubTab() === 'edit'}>
                              <div class="space-y-5">
                                <div class="grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Role name
                                    </label>
                                    <input
                                      type="text"
                                      value={roleName()}
                                      disabled={!props.canManage || r().name === EVERYONE}
                                      onInput={(e) => setRoleName(e.currentTarget.value)}
                                      class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
                                    />
                                  </div>
                                  <div>
                                    <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Role color
                                    </label>
                                    <div class="flex gap-2">
                                      <input
                                        type="color"
                                        value={roleColorHex()}
                                        disabled={!props.canManage}
                                        onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                                        class="h-10 w-14 cursor-pointer rounded border border-input bg-background p-1 disabled:opacity-60"
                                      />
                                      <input
                                        type="text"
                                        value={roleColorHex()}
                                        disabled={!props.canManage}
                                        onInput={(e) => setRoleColorHex(e.currentTarget.value)}
                                        class="h-10 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground disabled:opacity-60"
                                        placeholder="#5865F2"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div class="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/20 p-4">
                                  <div class="flex items-center justify-between gap-4">
                                    <div>
                                      <p class="text-sm font-medium text-foreground">Show role separately</p>
                                      <p class="text-xs text-muted-foreground">
                                        List members with this role in their own group in the member list.
                                      </p>
                                    </div>
                                    <DiscordToggle
                                      checked={roleHoist()}
                                      disabled={!props.canManage}
                                      onChange={setRoleHoist}
                                    />
                                  </div>
                                  <div class="flex items-center justify-between gap-4 border-t border-border/40 pt-4">
                                    <div>
                                      <p class="text-sm font-medium text-foreground">Allow @mentions for this role</p>
                                      <p class="text-xs text-muted-foreground">
                                        Members can mention this role when they have mention permissions.
                                      </p>
                                    </div>
                                    <DiscordToggle
                                      checked={roleMentionable()}
                                      disabled={!props.canManage}
                                      onChange={setRoleMentionable}
                                    />
                                  </div>
                                </div>

                                <div class="flex flex-wrap items-center gap-3">
                                  <Show when={props.canManage}>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPermMask(0)}>
                                      Clear permissions
                                    </Button>
                                  </Show>
                                </div>

                                <div>
                                  <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 class="text-sm font-semibold text-foreground">Space-wide permissions</h4>
                                    <input
                                      type="search"
                                      placeholder="Search permissions…"
                                      value={permSearch()}
                                      onInput={(e) => setPermSearch(e.currentTarget.value)}
                                      class="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground sm:max-w-xs"
                                    />
                                  </div>
                                  <div class="space-y-1 rounded-xl border border-border/60 bg-card/10 p-2">
                                    <For each={filteredPermRows()}>
                                      {(row) => (
                                        <div class="flex items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-muted/20">
                                          <div class="min-w-0 flex-1">
                                            <p class="text-sm font-medium text-foreground">{row.label}</p>
                                            <p class="text-xs text-muted-foreground">{row.description}</p>
                                          </div>
                                          <DiscordToggle
                                            checked={hasPerm(permMask(), row.bit)}
                                            disabled={!props.canManage}
                                            onChange={(on) => setPermMask(togglePerm(permMask(), row.bit, on))}
                                          />
                                        </div>
                                      )}
                                    </For>
                                  </div>
                                </div>

                                <Show when={props.canManage}>
                                  <Button type="button" onClick={() => saveRole()} loading={busy()} disabled={busy()}>
                                    Save changes
                                  </Button>
                                </Show>
                              </div>
                            </Show>

                            <Show when={rolesSubTab() === 'channel'}>
                              <Show when={!props.roomId}>
                                <p class="text-sm text-muted-foreground">Open a text channel to edit overrides.</p>
                              </Show>
                              <Show when={props.roomId}>
                                <p class="text-sm text-muted-foreground mb-4">
                                  Allow/deny bitmasks stack per role. Same bit values as space permissions (e.g. send
                                  messages = 2).
                                </p>
                                <div class="grid max-w-md gap-4 sm:grid-cols-2">
                                  <div>
                                    <label class="mb-1 text-xs text-muted-foreground">Allow (decimal)</label>
                                    <Input value={allowStr()} onInput={(e) => setAllowStr(e.currentTarget.value)} />
                                  </div>
                                  <div>
                                    <label class="mb-1 text-xs text-muted-foreground">Deny (decimal)</label>
                                    <Input value={denyStr()} onInput={(e) => setDenyStr(e.currentTarget.value)} />
                                  </div>
                                </div>
                                <Show when={props.canManage}>
                                  <Button type="button" class="mt-4" size="sm" onClick={() => saveOverride()} disabled={busy()}>
                                    Save channel override
                                  </Button>
                                </Show>
                              </Show>
                            </Show>

                            <Show when={rolesSubTab() === 'members'}>
                              <p class="mb-3 text-sm text-muted-foreground">
                                Pick a member and toggle which custom roles they have (@everyone always applies).
                              </p>
                              <select
                                class="mb-4 w-full max-w-md rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                value={selectedMemberId()}
                                onChange={(e) => setSelectedMemberId(e.currentTarget.value)}
                              >
                                <option value="">Select member…</option>
                                <For each={props.members.filter((m) => m.id !== props.ownerId)}>
                                  {(m) => (
                                    <option value={m.id}>
                                      {m.display_name || m.username}#{m.discriminator}
                                    </option>
                                  )}
                                </For>
                              </select>
                              <Show when={selectedMemberId()}>
                                <div class="space-y-2 rounded-xl border border-border/60 bg-card/10 p-3">
                                  <For each={roles()?.filter((x) => x.name !== EVERYONE) ?? []}>
                                    {(role) => (
                                      <div class="flex items-center justify-between gap-3 rounded-lg px-2 py-2">
                                        <span class="text-sm">{role.name}</span>
                                        <DiscordToggle
                                          checked={memberRolePick().has(role.id)}
                                          disabled={!props.canManage}
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
                                <Show when={props.canManage}>
                                  <Button type="button" class="mt-4" size="sm" onClick={() => saveMemberRoles()} disabled={busy()}>
                                    Save member roles
                                  </Button>
                                </Show>
                              </Show>
                            </Show>
                          </>
                        )}
                      </Show>
                    </div>
                  </div>
                </Show>

              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
