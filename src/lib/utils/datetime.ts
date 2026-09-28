import { formatDate, t } from '../../i18n';

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

/** Format: "Today at 2:30 PM" | "Yesterday at 2:30 PM" | "MM/DD/YY, 2:30 PM" (in the UI language) */
export function formatMessageTimestamp(date: Date): string {
  const now = new Date();
  const today = dayStart(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = dayStart(date);
  const time = formatDate(date, timeOnlyOptions);
  if (msgDay.getTime() === today.getTime()) {
    return t('time.todayAt', { time });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return t('time.yesterdayAt', { time });
  }
  return formatDate(date, fallbackOptions);
}

/** Time of day only, e.g. "2:30 PM" (in the UI language). */
export function formatTimeOfDay(date: Date): string {
  return formatDate(date, timeOnlyOptions);
}

/** Format date for chat date headers (e.g. "February 25, 2026") */
export function formatDateHeader(date: Date): string {
  return formatDate(date, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Long calendar date, e.g. "February 25, 2026", or undefined for an unparseable value. */
export function formatLongDate(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return formatDateHeader(d);
}
