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
