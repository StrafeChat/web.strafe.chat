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
  /** Shown after a failed restore attempt (wrong PIN / corrupt backup) */
  lastSubmitError: string | null;
  /** Web Crypto unavailable (non-secure context); not a wrong PIN */
  e2eeEnvironmentError: string | null;
}

export const [recoveryPin, setRecoveryPin] = createStore<RecoveryPinState>({
  pending: null,
  lastSubmitError: null,
  e2eeEnvironmentError: null,
});

export type PromptRecoveryPinOptions = {
  /** Keep `lastSubmitError` visible (used when re-prompting after a wrong PIN). */
  retainSubmitError?: boolean;
};

/** Show recovery PIN modal. Returns promise that resolves with the PIN when user submits. */
export function promptRecoveryPin(
  mode: RecoveryPinMode,
  opts?: PromptRecoveryPinOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const keepErr = opts?.retainSubmitError === true;
    setRecoveryPin({
      pending: { mode, resolve, reject },
      lastSubmitError: keepErr ? recoveryPin.lastSubmitError : null,
    });
  });
}

/** Called when user submits PIN (or cancels). */
export function submitRecoveryPin(pin: string | null): void {
  const { pending } = recoveryPin;
  if (!pending) return;
  if (pin !== null) {
    setRecoveryPin('lastSubmitError', null);
    pending.resolve(pin);
    setRecoveryPin({ pending: null });
  } else {
    setRecoveryPin({ pending: null, lastSubmitError: null });
    pending.reject(new Error('Recovery cancelled'));
  }
}
