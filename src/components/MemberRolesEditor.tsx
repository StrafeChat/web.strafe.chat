import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { setMemberSpaceRoles } from '../api/spaces';
import type { SpaceRole } from '../api/spaces';
import { translateRoleApiError } from '../lib/formatApiError';
import { compareRolesHighestFirst } from '../lib/roleOrder';
import { canChangeMemberRole, spaceRoleColorHex } from '../lib/spacePermissions';
import { rolesForMemberChips } from '../lib/userProfilePopoverHelpers';
import { appMenuItemDefault, appMenuPanel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';
import { RolePill } from './RolePill';
import { SearchInput } from './ui/SearchInput';

const EVERYONE_ROLE_NAME = '@everyone';

interface Props {
  spaceId: string;
  userId: string;
  spaceRoles: SpaceRole[];
  /** Role ids the member currently holds, including @everyone. */
  roleIds: string[];
  canManage: boolean;
  /** Roles at or above this position can't be handed out by the viewer (owner: Infinity). */
  viewerHighestPosition?: number;
  /** Truncate the chip row after this many roles; omit to show every role. */
  maxVisible?: number;
  /** Receives the saved role ids, including @everyone. */
  onSaved: (roleIds: string[]) => void;
  /** Lets a popover remeasure when the chip row grows or shrinks. */
  onLayoutChange?: () => void;
}

/**
 * The inline member-role editor: each held role is a pill with an X, and the + opens a
 * searchable dropdown of roles the viewer may still hand out. Saves immediately on every
 * add/remove, then reports the new ids so the caller can refresh its profile subject.
 */
export const MemberRolesEditor: Component<Props> = (props) => {
  const [picked, setPicked] = createSignal<Set<string>>(new Set());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');
  const [expanded, setExpanded] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [menuAnchor, setMenuAnchor] = createSignal<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  let addBtnEl: HTMLButtonElement | undefined;
  let menuEl: HTMLDivElement | undefined;

  const everyoneId = () => props.spaceRoles.find((r) => r.name === EVERYONE_ROLE_NAME)?.id;
  const roleCeiling = () => props.viewerHighestPosition ?? Number.POSITIVE_INFINITY;
  const roleChangeable = (role: SpaceRole) => canChangeMemberRole(role, roleCeiling());

  function revertPicked() {
    const eid = everyoneId();
    setPicked(new Set(props.roleIds.filter((id) => id !== eid)));
  }

  // The caller owns the role ids (popover store / full-profile store), so mirror them
  // whenever they change, including after a save.
  createEffect(() => {
    const roleIds = props.roleIds;
    const eid = everyoneId();
    setPicked(new Set(roleIds.filter((id) => id !== eid)));
    setError('');
  });

  // A new member gets a clean menu and an unexpanded chip row.
  createEffect(() => {
    void props.userId;
    setMenuOpen(false);
    setSearch('');
    setExpanded(false);
  });

  const displayedRoles = createMemo((): SpaceRole[] => {
    if (!props.canManage) return rolesForMemberChips(props.roleIds, props.spaceRoles);
    const byId = new Map(props.spaceRoles.map((r) => [r.id, r]));
    const list: SpaceRole[] = [];
    for (const id of picked()) {
      const role = byId.get(id);
      if (role && role.name !== EVERYONE_ROLE_NAME) list.push(role);
    }
    list.sort(compareRolesHighestFirst);
    return list;
  });

  const visibleRoles = createMemo(() => {
    const limit = props.maxVisible;
    return limit == null || expanded() ? displayedRoles() : displayedRoles().slice(0, limit);
  });
  const hiddenCount = createMemo(() => {
    const limit = props.maxVisible;
    return limit == null ? 0 : Math.max(0, displayedRoles().length - limit);
  });

  const availableRoles = createMemo(() => {
    if (!props.canManage) return [];
    return props.spaceRoles
      .filter(
        (r) =>
          r.name !== EVERYONE_ROLE_NAME &&
          !picked().has(r.id) &&
          roleChangeable(r),
      )
      .sort(compareRolesHighestFirst);
  });

  const filteredRoles = createMemo(() => {
    const q = search().trim().toLowerCase();
    const list = availableRoles();
    return q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list;
  });

  // Track the states that change this block's height so a popover can keep itself placed.
  createEffect(() => {
    visibleRoles();
    displayedRoles();
    expanded();
    error();
    menuOpen();
    props.onLayoutChange?.();
  });

  async function persist(next: Set<string>) {
    if (!props.canManage) return;
    setError('');
    setBusy(true);
    try {
      const chosen = [...next];
      await setMemberSpaceRoles(props.spaceId, props.userId, chosen);
      const merged: string[] = [];
      if (everyoneId()) merged.push(everyoneId()!);
      for (const id of chosen) {
        if (!merged.includes(id)) merged.push(id);
      }
      props.onSaved(merged);
    } catch (e) {
      setError(translateRoleApiError(e, t).join(' ') || t('profile.rolesUpdateFailed'));
      revertPicked();
    } finally {
      setBusy(false);
    }
  }

  async function removeRole(roleId: string) {
    if (!props.canManage || busy()) return;
    const next = new Set(picked());
    next.delete(roleId);
    setPicked(next);
    await persist(next);
  }

  async function addRole(roleId: string) {
    if (!props.canManage || busy()) return;
    const next = new Set(picked());
    next.add(roleId);
    setPicked(next);
    setMenuOpen(false);
    await persist(next);
  }

  // Portal the add menu so it can overlap the card (which clips its own overflow) and the
  // page. It opens below the + when that fits, else above; `maxHeight` is what the chosen
  // side can hold, so a long list scrolls inside the viewport instead of running off it.
  function placeMenu() {
    const btn = addBtnEl;
    const menu = menuEl;
    if (!btn || !menu) return;
    const r = btn.getBoundingClientRect();
    const h = menu.offsetHeight;
    const w = menu.offsetWidth;
    const gap = 6;
    const edge = 8;
    const belowSpace = window.innerHeight - r.bottom - gap - edge;
    const aboveSpace = r.top - gap - edge;
    const fitsBelow = h <= belowSpace;
    const fitsAbove = h <= aboveSpace;
    const openBelow = fitsBelow || (!fitsAbove && belowSpace >= aboveSpace);
    const maxHeight = Math.max(80, openBelow ? belowSpace : aboveSpace);
    const top = openBelow ? r.bottom + gap : r.top - gap - Math.min(h, maxHeight);
    const left = Math.max(edge, Math.min(r.left, window.innerWidth - w - edge));
    setMenuAnchor({ top, left, maxHeight });
  }

  createEffect(() => {
    if (!menuOpen()) {
      setSearch('');
      setMenuAnchor(null);
      return;
    }
    setMenuAnchor(null);
    const raf = requestAnimationFrame(() => {
      placeMenu();
      menuEl?.querySelector('input')?.focus({ preventScroll: true });
    });
    const onReflow = () => placeMenu();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    });
  });

  createEffect(() => {
    if (!menuOpen()) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuEl?.contains(target) || addBtnEl?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    onCleanup(() => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
    });
  });

  return (
    <>
      <div class="flex flex-wrap items-center gap-1.5">
        <For each={visibleRoles()}>
          {(role) => (
            <RolePill
              role={{ id: role.id, name: role.name, color: role.color ?? 0 }}
              onRemove={
                props.canManage && roleChangeable(role)
                  ? () => void removeRole(role.id)
                  : undefined
              }
              removeLabel={t('profile.removeRole', { name: role.name })}
              disabled={busy()}
            />
          )}
        </For>
        <Show when={!expanded() && hiddenCount() > 0}>
          <button
            type="button"
            class="inline-flex items-center rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
            title={t('profile.moreRoles', { count: hiddenCount() })}
            aria-label={t('profile.moreRoles', { count: hiddenCount() })}
            aria-expanded={expanded()}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
          >
            +{hiddenCount()}
          </button>
        </Show>
        <Show when={props.canManage}>
          <button
            id="profile-role-add-btn"
            ref={(el) => (addBtnEl = el)}
            type="button"
            disabled={busy()}
            class="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border/90 text-muted-foreground transition hover:border-primary/60 hover:bg-muted/40 hover:text-foreground disabled:opacity-40"
            title={t('profile.addRole')}
            aria-label={t('profile.addRole')}
            aria-expanded={menuOpen()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <i class="fa-solid fa-plus text-xs" />
          </button>
          <Show when={menuOpen()}>
            <Portal mount={document.body}>
              <div
                id="profile-role-add-menu"
                ref={(el) => (menuEl = el)}
                class={`fixed flex w-56 flex-col ${zLayer.popover} ${appMenuPanel}`}
                style={{
                  top: `${menuAnchor()?.top ?? -9999}px`,
                  left: `${menuAnchor()?.left ?? -9999}px`,
                  'max-height': menuAnchor() ? `${menuAnchor()!.maxHeight}px` : undefined,
                  visibility: menuAnchor() ? 'visible' : 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div class="shrink-0 px-1.5 pb-2 pt-1.5">
                  <SearchInput
                    value={search()}
                    onValueChange={setSearch}
                    size="sm"
                    wrapperClass="w-full"
                    placeholder={t('profile.searchRoles')}
                    class="focus:border-input! focus-visible:ring-0!"
                    autofocus
                  />
                </div>
                <div class="min-h-0 flex-1 overflow-y-auto pt-1" style={{ 'max-height': '180px' }}>
                  <Show
                    when={filteredRoles().length > 0}
                    fallback={
                      <p class="px-3 py-2 text-xs text-muted-foreground">
                        {availableRoles().length === 0
                          ? t('profile.noRolesToAdd')
                          : t('profile.noRolesMatch')}
                      </p>
                    }
                  >
                    <For each={filteredRoles()}>
                      {(role) => (
                        <button
                          type="button"
                          class={appMenuItemDefault}
                          onClick={() => void addRole(role.id)}
                        >
                          <span
                            class="size-2 shrink-0 rounded-full ring-1 ring-border/40"
                            style={{ 'background-color': spaceRoleColorHex(role.color) }}
                          />
                          <span class="truncate">{role.name}</span>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </Portal>
          </Show>
        </Show>
      </div>
      <Show when={error()}>
        <p class="mt-1 text-xs text-destructive">{error()}</p>
      </Show>
    </>
  );
};
