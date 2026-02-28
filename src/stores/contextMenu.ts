import { createSignal } from 'solid-js';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  /** Receives the click event so handlers can e.g. check shiftKey. */
  onClick: (e?: MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}

const [state, setState] = createSignal<{
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}>({ open: false, x: 0, y: 0, items: [] });

export const contextMenuState = state;

export function showContextMenu(e: MouseEvent, items: ContextMenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  setState({
    open: true,
    x: e.clientX,
    y: e.clientY,
    items,
  });
}

export function closeContextMenu() {
  setState((s) => ({ ...s, open: false }));
}
