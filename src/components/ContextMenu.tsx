import type { Component } from 'solid-js';
import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { contextMenuState, closeContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';
import { appMenuItemDanger, appMenuItemDefault, appMenuItemDisabled, appMenuPanel, zLayer } from '../theme/appChrome';

const EDGE = 8;
const SUBMENU_GAP = 4;

interface OpenSubmenu {
  label: string;
  items: ContextMenuItem[];
  anchor: DOMRect;
}

/**
 * The one context menu for the whole app, driven by the contextMenu store.
 *
 * Portaled to document.body on purpose: AppShell is a `relative z-10` stacking context, so
 * a menu rendered inside it can never paint above a modal that portals itself to the body
 * at a higher tier - which is why right-clicking a row in space settings put the menu
 * *behind* the settings modal.
 */
export const ContextMenu: Component = () => {
  const state = contextMenuState;
  /** Null until the panel has been measured, so it never flashes at an unclamped spot. */
  const [pos, setPos] = createSignal<{ left: number; top: number } | null>(null);
  const [submenu, setSubmenu] = createSignal<OpenSubmenu | null>(null);
  const [submenuPos, setSubmenuPos] = createSignal<{ left: number; top: number } | null>(null);
  let menuEl: HTMLDivElement | undefined;
  let submenuEl: HTMLDivElement | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => clearTimeout(hideTimer));

  function place() {
    const s = state();
    const el = menuEl;
    if (!s.open || !el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(EDGE, Math.min(s.x, window.innerWidth - width - EDGE)),
      top: Math.max(EDGE, Math.min(s.y, window.innerHeight - height - EDGE)),
    });
  }

  function placeSubmenu() {
    const current = submenu();
    const el = submenuEl;
    if (!current || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const panel = menuEl?.getBoundingClientRect();
    let left = (panel?.right ?? current.anchor.right) + SUBMENU_GAP;
    if (left + width > window.innerWidth - EDGE) {
      left = (panel?.left ?? current.anchor.left) - width - SUBMENU_GAP;
    }
    const top = current.anchor.top - 6;
    setSubmenuPos({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE)),
      top: Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE)),
    });
  }

  function cancelHide() {
    clearTimeout(hideTimer);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => setSubmenu(null), 150);
  }

  function openSubmenu(item: ContextMenuItem, el: HTMLElement) {
    if (!item.submenu?.length) {
      setSubmenu(null);
      return;
    }
    cancelHide();
    setSubmenu({ label: item.label, items: item.submenu, anchor: el.getBoundingClientRect() });
  }

  const activate = (item: ContextMenuItem, e: MouseEvent, el: HTMLElement) => {
    if (item.disabled) return;
    if (item.submenu?.length) {
      openSubmenu(item, el);
      return;
    }
    item.onClick(e);
    closeContextMenu();
  };

  createEffect(() => {
    if (!state().open) {
      setPos(null);
      setSubmenu(null);
      return;
    }
    // Measure the real panel rather than guessing its size: a two-item menu was being
    // pushed far above the cursor by a hard-coded max height. Clearing first keeps a
    // re-open at a new spot from showing one frame at the old one.
    setPos(null);
    requestAnimationFrame(place);
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && (menuEl?.contains(target) || submenuEl?.contains(target))) return;
      closeContextMenu();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    const handleReflow = () => closeContextMenu();
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleReflow);
    // onCleanup, not a returned function: createEffect passes a returned value to the next
    // run, it does not treat it as a teardown - so these listeners used to leak on close.
    onCleanup(() => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleReflow);
    });
  });

  createEffect(() => {
    if (!submenu()) {
      setSubmenuPos(null);
      return;
    }
    setSubmenuPos(null);
    requestAnimationFrame(placeSubmenu);
  });

  const itemClass = (item: ContextMenuItem) =>
    item.disabled ? appMenuItemDisabled : item.danger ? appMenuItemDanger : appMenuItemDefault;

  return (
    <Show when={state().open}>
      <Portal mount={document.body}>
        <div
          ref={(el) => {
            menuEl = el;
          }}
          id="context-menu-portal"
          role="menu"
          class={`fixed ${zLayer.popover} min-w-[180px] max-h-[min(70vh,24rem)] overflow-y-auto ${appMenuPanel}`}
          style={{
            left: `${pos()?.left ?? state().x}px`,
            top: `${pos()?.top ?? state().y}px`,
            visibility: pos() ? 'visible' : 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex flex-col gap-0.5">
            <For each={state().items}>
              {(item) => (
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  aria-haspopup={item.submenu?.length ? 'menu' : undefined}
                  aria-expanded={item.submenu?.length ? submenu()?.items === item.submenu : undefined}
                  class={itemClass(item)}
                  onPointerEnter={(e) => openSubmenu(item, e.currentTarget)}
                  onPointerLeave={() => {
                    if (item.submenu?.length) scheduleHide();
                  }}
                  onClick={(e) => activate(item, e, e.currentTarget)}
                >
                  {item.icon && (
                    <i
                      class={`fa-solid ${item.icon} w-4 shrink-0 text-center text-[13px]`}
                      style={item.color ? { color: item.color } : undefined}
                      aria-hidden="true"
                    />
                  )}
                  <span class="truncate">{item.label}</span>
                  <Show when={item.submenu?.length}>
                    <i class="fa-solid fa-chevron-right ms-auto text-[10px] text-muted-foreground" aria-hidden="true" />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>
        <Show when={submenu()}>
          {(current) => (
            <div
              ref={(el) => {
                submenuEl = el;
              }}
              id="context-submenu-portal"
              role="menu"
              aria-label={current().label}
              class={`fixed ${zLayer.popover} min-w-[180px] max-h-[min(70vh,24rem)] overflow-y-auto ${appMenuPanel}`}
              style={{
                left: `${submenuPos()?.left ?? current().anchor.right + SUBMENU_GAP}px`,
                top: `${submenuPos()?.top ?? current().anchor.top}px`,
                visibility: submenuPos() ? 'visible' : 'hidden',
              }}
              onPointerEnter={cancelHide}
              onPointerLeave={scheduleHide}
              onClick={(e) => e.stopPropagation()}
            >
              <div class="flex flex-col gap-0.5">
                <For each={current().items}>
                  {(item) => (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      class={itemClass(item)}
                      onClick={(e) => activate(item, e, e.currentTarget)}
                    >
                      {item.icon && (
                        <i
                          class={`fa-solid ${item.icon} w-4 shrink-0 text-center text-[13px]`}
                          style={item.color ? { color: item.color } : undefined}
                          aria-hidden="true"
                        />
                      )}
                      <span class="truncate">{item.label}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>
      </Portal>
    </Show>
  );
};
