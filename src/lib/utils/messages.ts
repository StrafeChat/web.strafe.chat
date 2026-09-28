const FLASH_CLASS = 'msg-jump-flash';
const FLASH_MS = 1600;

/** Scroll a message into view and briefly highlight it so the eye lands on the right row. */
export function scrollToMessage(messageId: string) {
  if (typeof document === 'undefined') return;
  if (!messageId) return;
  const el = document.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove(FLASH_CLASS);
  // Restart the animation even if the same row was flashed a moment ago.
  void el.offsetWidth;
  el.classList.add(FLASH_CLASS);
  window.setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS);
}

/** Same jump, but for a message that may not be on screen yet - e.g. right after a search
 * result navigated to a different channel and its history is still loading. Gives up
 * quietly once the window passes, exactly like scrollToMessage does for a message that
 * isn't in the loaded page at all. */
export function scrollToMessageWhenReady(messageId: string, timeoutMs = 3000) {
  if (typeof document === 'undefined' || !messageId) return;
  const started = Date.now();
  const tick = () => {
    if (document.querySelector(`[data-msg-id="${messageId}"]`)) {
      scrollToMessage(messageId);
      return;
    }
    if (Date.now() - started < timeoutMs) window.setTimeout(tick, 150);
  };
  tick();
}
