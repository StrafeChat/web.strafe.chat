const timeOnlyOptions: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const fallbackOptions: Intl.DateTimeFormatOptions = {
  month: 'numeric',
  day: 'numeric',
  year: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
};

/** Start of calendar day in local timezone */
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Format: "Today at 2:30 PM" | "Yesterday at 2:30 PM" | "MM/DD/YY, 2:30 PM" */
export function formatMessageTimestamp(date: Date): string {
  const now = new Date();
  const today = dayStart(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = dayStart(date);
  const timeStr = date.toLocaleTimeString(undefined, timeOnlyOptions);
  if (msgDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return `Yesterday at ${timeStr}`;
  }
  return date.toLocaleString(undefined, fallbackOptions);
}

/** Format date for chat date headers (e.g. "February 25, 2026") */
export function formatDateHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
