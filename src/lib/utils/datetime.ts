/** Format date as MM/DD/YY, HH:MM AM/PM (Discord-style) */
export function formatMessageTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Format date for chat date headers (e.g. "February 25, 2026") */
export function formatDateHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
