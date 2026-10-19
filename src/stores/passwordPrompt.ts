/**
 * The account password as a question a flow can await, for code that runs outside the
 * component tree.
 *
 * Settings pages that need the password render PasswordPromptDialog themselves. The
 * key-backup flow cannot: it runs from device bootstrap (stores/e2eeBackup.ts) with no
 * component to own a dialog. So, like confirmDialog and recoveryPrompt, the question is
 * raised here and PasswordPromptHost in the root layout renders it.
 */

import { createStore } from 'solid-js/store';

export interface PasswordPromptOptions {
  title: string;
  description?: string;
  confirmLabel: string;
  /** `danger` paints the confirm button red. */
  tone?: 'default' | 'danger';
  /** Keep the previous attempt's error under the input (a wrong password, asked again). */
  retainSubmitError?: boolean;
}

/** The user closed the prompt. Every flow treats it as "leave things as they are". */
export class PasswordPromptCancelled extends Error {
  constructor() {
    super('password prompt cancelled');
    this.name = 'PasswordPromptCancelled';
  }
}

interface PasswordPromptState {
  pending: {
    options: PasswordPromptOptions;
    resolve: (password: string) => void;
    reject: (err: Error) => void;
  } | null;
  /** Shown under the input when the prompt is raised again after a wrong password. */
  lastSubmitError: string | null;
}

export const [passwordPromptState, setPasswordPromptState] = createStore<PasswordPromptState>({
  pending: null,
  lastSubmitError: null,
});

/** Ask for the password. Resolves with it on confirm; rejects with PasswordPromptCancelled on close. */
export function promptPassword(options: PasswordPromptOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    // A prompt raised while another is open cancels the first one.
    passwordPromptState.pending?.reject(new PasswordPromptCancelled());
    setPasswordPromptState({
      pending: { options, resolve, reject },
      lastSubmitError: options.retainSubmitError ? passwordPromptState.lastSubmitError : null,
    });
  });
}

/** Answer the open prompt. */
export function submitPasswordPrompt(password: string): void {
  const { pending } = passwordPromptState;
  if (!pending) return;
  setPasswordPromptState({ pending: null, lastSubmitError: null });
  pending.resolve(password);
}

/** Close the open prompt without an answer. */
export function cancelPasswordPrompt(): void {
  const { pending } = passwordPromptState;
  if (!pending) return;
  setPasswordPromptState({ pending: null, lastSubmitError: null });
  pending.reject(new PasswordPromptCancelled());
}

/** Put an error under the input of the prompt that is about to be raised again. */
export function setPasswordPromptError(message: string | null): void {
  setPasswordPromptState('lastSubmitError', message);
}
