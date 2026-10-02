/**
 * "Just start typing" behaviour for the message composer: focus it on entering a room, and
 * when a printable key is pressed with nothing else focused, send that keystroke to the
 * composer instead of dropping it.
 *
 * Lives here rather than in a page because both RoomPage and SpacePage need it and the two
 * copies had already drifted - space rooms had neither half.
 */

import { createEffect, onCleanup, onMount } from 'solid-js';

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
  if (modalOpen()) return false;
  return true;
}

// A coarse pointer (a phone) should never be auto-focused: it pops the on-screen keyboard
// unbidden - on entering a room, and again every time the room object updates - which is
// exactly what "the textbox keeps popping up" was.
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Anything modal owns the keyboard while it is open, including when focus has landed on the
 * body rather than inside the dialog - which a per-target check alone misses.
 */
function modalOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('[role="dialog"], [data-modal]');
}

/**
 * True when something in the page already holds focus, so the composer must not take it.
 *
 * Focus inside the app chrome - a header search box, a filter field, a picker search - is as
 * legitimate as focus inside a dialog, and stealing it is the same bug.
 */
function focusHeld(): boolean {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  return !!active && active !== document.body && active instanceof HTMLElement;
}

/**
 * Re-focus whenever the room on screen changes, and when the composer first mounts.
 *
 * Deliberately compares by hand rather than leaning on `on(deps, fn)` to do it: `on` only
 * narrows what a tracked scope reads, it does not compare anything. Without a comparison this
 * effect re-runs on every notification of the room store, which a new message triggers
 * (`updateRoomLastMessage` replaces the room object) - so every incoming message yanked the
 * caret out of whatever field you were typing in and back down to the composer.
 */
export function createComposerAutoFocus(opts: ComposerAutoFocusOptions): void {
  const enabled = () => opts.enabled?.() ?? true;

  let lastKey: string | undefined;
  let lastEl: HTMLTextAreaElement | undefined;
  createEffect(() => {
    const key = opts.focusKey();
    const el = opts.inputRef();
    if (key === lastKey && el === lastEl) return;
    lastKey = key;
    lastEl = el;
    if (!key || !el || !enabled() || coarsePointer()) return;
    // A modal is open, or the page already holds focus somewhere: this is a room change
    // underneath an active conversation, not someone asking for the composer.
    if (modalOpen() || focusHeld()) return;
    queueMicrotask(() => {
      // Re-check at the point of the focus call: a dialog can open between the effect and
      // the microtask, and taking focus then is the exact bug being fixed.
      if (modalOpen()) return;
      el.focus({ preventScroll: true });
    });
  });

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
