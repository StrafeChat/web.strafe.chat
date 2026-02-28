import type { Component } from 'solid-js';
import { Show, createEffect } from 'solid-js';
import { contextMenuState, closeContextMenu } from '../stores/contextMenu';
import type { ContextMenuItem } from '../stores/contextMenu';

export const ContextMenu: Component = () => {
  const state = contextMenuState;

  createEffect(() => {
    if (!state().open) return;
    const handleClick = () => closeContextMenu();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  });

  const runAndClose = (item: ContextMenuItem, e: MouseEvent) => {
    if (item.disabled) return;
    item.onClick(e);
    closeContextMenu();
  };

  return (
    <Show when={state().open}>
      <div
        id="context-menu-portal"
        role="menu"
        class="fixed z-[100] min-w-[180px] rounded-lg border border-border bg-[hsl(0_0%_10%)] shadow-xl overflow-hidden"
        style={{
          left: `${Math.min(state().x, window.innerWidth - 200)}px`,
          top: `${Math.min(state().y, window.innerHeight - 200)}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {state().items.map((item, index) => {
          const items = state().items;
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const roundedClass =
            isFirst && isLast ? 'rounded-lg' : isFirst ? 'rounded-t-lg' : isLast ? 'rounded-b-lg' : '';
          return (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              class={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${roundedClass} ${
                item.disabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : item.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground hover:bg-accent'
              }`}
              onClick={(e) => runAndClose(item, e)}
            >
              {item.icon && <i class={`fa-solid ${item.icon} w-4 shrink-0 text-center`} />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Show>
  );
};
