const FLASH_CLASS = 'msg-jump-flash';
const FLASH_MS = 1600;

/** Briefly highlight a message row so the eye lands on it after a jump. */
export function flashMessageRow(el: HTMLElement) {
  el.classList.remove(FLASH_CLASS);
  // Restart the animation even if the same row was flashed a moment ago.
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS);
}

/**
 * Scroll an already-loaded message into view and flash it. For a message that may not be in
 * the loaded window (a reply target, a search hit), use jumpToMessage from stores/messages,
 * which loads a window around it first.
 */
export function scrollToMessage(messageId: string) {
  if (typeof document === 'undefined') return;
  if (!messageId) return;
  const el = document.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  flashMessageRow(el);
}
