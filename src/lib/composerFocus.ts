/**
 * "Just start typing" behaviour for the message composer: focus it on entering a room, and
 * when a printable key is pressed with nothing else focused, send that keystroke to the
 * composer instead of dropping it.
 *
 * Lives here rather than in a page because both RoomPage and SpacePage need it and the two
 * copies had already drifted - space rooms had neither half.
 */

import { createEffect, on, onCleanup, onMount } from 'solid-js';

export interface ComposerAutoFocusOptions {
  /** The composer textarea, once it is mounted. Undefined while it isn't (e.g. no send permission). */
  inputRef: () => HTMLTextAreaElement | undefined;
  /** Re-focus whenever this changes - the room currently on screen. */
  focusKey: () => string | undefined;
  /** False while the composer shouldn't take focus at all (not a text room, still loading). */
  enabled?: () => boolean;
  /** Append one typed character to the draft and leave the caret after it. */
  onType: (char: string) => void;
}

/** True when a printable character should be redirected into the composer. */
function shouldRedirectKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  // Printable single characters only: ignore Enter/Tab/arrows and every named key.
  if (e.key.length !== 1 || e.key.charCodeAt(0) < 32) return false;
  const target = e.target as Node | null;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return false;
  }
  // Anything modal owns the keyboard while it is open - including when focus has landed on
  // the body rather than inside the dialog, which the per-target check alone missed.
  if (document.querySelector('[role="dialog"], [data-modal]')) return false;
  return true;
}

// A coarse pointer (a phone) should never be auto-focused: it pops the on-screen keyboard
// unbidden - on entering a room, and again every time the room object updates - which is
// exactly what "the textbox keeps popping up" was.
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export function createComposerAutoFocus(opts: ComposerAutoFocusOptions): void {
  const enabled = () => opts.enabled?.() ?? true;

  // Focus on entering a room, and when the composer first mounts - but NOT when the room
  // object merely updates (a new message, a presence change). `on` compares the focus key,
  // so re-reading room state that returns the same room id does not re-fire this; a plain
  // createEffect did, silently refocusing on desktop and popping the keyboard on mobile.
  createEffect(
    on([opts.focusKey, opts.inputRef], ([key, el]) => {
      if (!key || !el || !enabled() || coarsePointer()) return;
      queueMicrotask(() => el.focus());
    })
  );

  onMount(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!enabled() || !shouldRedirectKey(e)) return;
      const input = opts.inputRef();
      if (!input || input.disabled) return;
      e.preventDefault();
      input.focus();
      opts.onType(e.key);
    }
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });
}
