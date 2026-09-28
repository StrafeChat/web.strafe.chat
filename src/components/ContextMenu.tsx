import type { Component } from 'solid-js';
import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { contextMenuState, closeContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';
import { appMenuItemDanger, appMenuItemDefault, appMenuItemDisabled, appMenuPanel, zLayer } from '../theme/appChrome';

const EDGE = 8;

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
  let menuEl: HTMLDivElement | undefined;

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

  createEffect(() => {
    if (!state().open) {
      setPos(null);
      return;
    }
    // Measure the real panel rather than guessing its size: a two-item menu was being
    // pushed far above the cursor by a hard-coded max height. Clearing first keeps a
    // re-open at a new spot from showing one frame at the old one.
    setPos(null);
    requestAnimationFrame(place);
    const handleClick = () => closeContextMenu();
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

  const runAndClose = (item: ContextMenuItem, e: MouseEvent) => {
    if (item.disabled) return;
    item.onClick(e);
    closeContextMenu();
  };

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
            {state().items.map((item) => (
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                class={itemClass(item)}
                onClick={(e) => runAndClose(item, e)}
              >
                {item.icon && <i class={`fa-solid ${item.icon} w-4 shrink-0 text-center text-[13px]`} aria-hidden="true" />}
                <span class="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Portal>
    </Show>
  );
};
