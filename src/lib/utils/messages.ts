export function scrollToMessage(messageId: string) {
  if (typeof document === 'undefined') return;
  if (!messageId) return;
  const el = document.querySelector<HTMLElement>(`[data-msg-id="${messageId}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

