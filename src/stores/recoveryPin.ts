/**
 * Recovery PIN flow – prompts user to enter PIN for backup create/restore.
 * Set by E2eeProvider; used by ensureDevice when backup is needed.
 */

import { createStore } from 'solid-js/store';

export type RecoveryPinMode = 'create' | 'restore';

export interface RecoveryPinState {
  /** When set, show the recovery PIN modal */
  pending: {
    mode: RecoveryPinMode;
    resolve: (pin: string) => void;
    reject: (err: Error) => void;
  } | null;
}

export const [recoveryPin, setRecoveryPin] = createStore<RecoveryPinState>({
  pending: null,
});

/** Show recovery PIN modal. Returns promise that resolves with the PIN when user submits. */
export function promptRecoveryPin(mode: RecoveryPinMode): Promise<string> {
  return new Promise((resolve, reject) => {
    setRecoveryPin({
      pending: { mode, resolve, reject },
    });
  });
}

/** Called when user submits PIN (or cancels). */
export function submitRecoveryPin(pin: string | null): void {
  const { pending } = recoveryPin;
  if (!pending) return;
  setRecoveryPin({ pending: null });
  if (pin !== null) {
    pending.resolve(pin);
  } else {
    pending.reject(new Error('Recovery cancelled'));
  }
}
