/**
 * Small event bus for chat keyboard shortcuts that cross component boundaries. The composer
 * (RoomMessageInput) and the message list (MessageList) are siblings under the page and don't
 * share state, so "press ↑ in the empty composer to edit your last message" - Discord's
 * shortcut - is relayed as a window event: the composer requests it, the open MessageList
 * (there's only ever one) acts on it. Mirrors the requestNavigate pattern in lib/notifications.
 */

const EDIT_LAST_EVENT = 'strafe:edit-last-message';

/** Ask the open message list to start editing the current user's most recent message. */
export function requestEditLastMessage(): void {
  window.dispatchEvent(new CustomEvent(EDIT_LAST_EVENT));
}

export function onEditLastMessageRequest(fn: () => void): () => void {
  window.addEventListener(EDIT_LAST_EVENT, fn);
  return () => window.removeEventListener(EDIT_LAST_EVENT, fn);
}
