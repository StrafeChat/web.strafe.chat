/**
 * App-styled replacement for `window.confirm`. `confirmDialog(...)` resolves `true` when the
 * user picks the confirm action and `false` on cancel / Escape / backdrop. The dialog itself
 * is rendered once by `ConfirmDialog` in the root layout.
 */

import { createStore } from 'solid-js/store';

export interface ConfirmDialogOptions {
  title: string;
  body?: string;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** `danger` paints the confirm button red and shows a warning chip. */
  tone?: 'default' | 'danger';
  /** Font Awesome class for the chip; defaults per tone. */
  icon?: string;
}

interface ConfirmDialogState {
  pending: { options: ConfirmDialogOptions; resolve: (ok: boolean) => void } | null;
}

export const [confirmDialogState, setConfirmDialogState] = createStore<ConfirmDialogState>({ pending: null });

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // A prompt raised while another is open cancels the first one.
    confirmDialogState.pending?.resolve(false);
    setConfirmDialogState('pending', { options, resolve });
  });
}

export function settleConfirmDialog(ok: boolean): void {
  const pending = confirmDialogState.pending;
  if (!pending) return;
  setConfirmDialogState('pending', null);
  pending.resolve(ok);
}
