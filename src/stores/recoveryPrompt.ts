/**
 * The three dialogs the key-backup flow needs, as promises the flow can await.
 *
 * Kept as a store rather than local component state because the flow that needs them runs
 * outside the component tree (stores/e2eeBackup.ts, driven by device bootstrap), and it has
 * to be able to ask a question and wait for the answer.
 */

import { createStore } from 'solid-js/store';

export type RecoveryPromptKind =
  /** A newly created recovery code, to be written down. Resolves when acknowledged. */
  | 'showCode'
  /** Ask for the recovery code so the backup can be read. Resolves with the code. */
  | 'enterCode'
  /** Ask for the old 6-digit PIN so a pre-upgrade backup can be folded in. Resolves with it. */
  | 'enterLegacyPin';

/** Why a prompt ended without an answer - the flow branches on this. */
export type RecoveryCancelReason = 'dismissed' | 'lostCode';

export class RecoveryPromptCancelled extends Error {
  constructor(readonly reason: RecoveryCancelReason) {
    super(`recovery prompt cancelled: ${reason}`);
    this.name = 'RecoveryPromptCancelled';
  }
}

export interface RecoveryPromptState {
  pending: {
    kind: RecoveryPromptKind;
    /** Only set for 'showCode'. */
    code?: string;
    resolve: (value: string) => void;
    reject: (err: Error) => void;
  } | null;
  /** Shown under the input after a failed attempt (wrong code / wrong PIN). */
  lastSubmitError: string | null;
  /** Web Crypto unavailable (an insecure context) - not a wrong answer, a broken environment. */
  e2eeEnvironmentError: string | null;
}

export const [recoveryPrompt, setRecoveryPrompt] = createStore<RecoveryPromptState>({
  pending: null,
  lastSubmitError: null,
  e2eeEnvironmentError: null,
});

function open(kind: RecoveryPromptKind, code: string | undefined, retainError: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    setRecoveryPrompt({
      pending: { kind, code, resolve, reject },
      lastSubmitError: retainError ? recoveryPrompt.lastSubmitError : null,
    });
  });
}

/** Show a freshly generated recovery code. Resolves once the user confirms they saved it,
 * rejects if they dismiss the dialog without confirming. */
export function promptShowRecoveryCode(code: string): Promise<string> {
  return open('showCode', code, false);
}

/** Ask for the recovery code. Rejects with RecoveryPromptCancelled on skip or "I lost it". */
export function promptRecoveryCode(opts?: { retainSubmitError?: boolean }): Promise<string> {
  return open('enterCode', undefined, opts?.retainSubmitError === true);
}

/** Ask for the legacy 6-digit PIN, to migrate an old backup. */
export function promptLegacyPin(opts?: { retainSubmitError?: boolean }): Promise<string> {
  return open('enterLegacyPin', undefined, opts?.retainSubmitError === true);
}

/** Answer the open prompt. */
export function submitRecoveryPrompt(value: string): void {
  const { pending } = recoveryPrompt;
  if (!pending) return;
  setRecoveryPrompt({ pending: null, lastSubmitError: null });
  pending.resolve(value);
}

/** Close the open prompt without an answer. */
export function cancelRecoveryPrompt(reason: RecoveryCancelReason = 'dismissed'): void {
  const { pending } = recoveryPrompt;
  if (!pending) return;
  setRecoveryPrompt({ pending: null, lastSubmitError: null });
  pending.reject(new RecoveryPromptCancelled(reason));
}

/** Put an error under the input of the prompt that is about to be re-opened. */
export function setRecoveryPromptError(message: string | null): void {
  setRecoveryPrompt('lastSubmitError', message);
}
