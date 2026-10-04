/**
 * Dynamic timestamps - `<t:UNIX_SECONDS[:STYLE]>` in message content.
 *
 * The token carries an absolute instant, never a rendered string, so every reader sees it in
 * their own timezone, 12/24-hour clock, date order and language. The sender's clock and locale
 * are irrelevant, which is the whole point: "standup at <t:…:t>" means 9am wherever it's read.
 *
 * The wire syntax is the familiar one, so a `<t:…>` pasted from another client renders here
 * unchanged, and a renderer that doesn't know the token just shows the raw text.
 */
import { currentLanguage, formatDate } from '../../i18n';

export type TimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

/** 'f' is the default: no `:f` and an empty style both mean short date + time. */
const DEFAULT_STYLE: TimestampStyle = 'f';

/**
 * Per-style `Intl` options. Deliberately *not* pinned to en-US ordering or a 12-hour clock:
 * hour/date-order choices are left to the reader's locale, which is what makes the same
 * message read correctly for everyone. The explicit `2-digit` day/month is what keeps the
 * numeric date zero-padded ("09/30/2026") rather than locale-loose.
 */
const ABSOLUTE_OPTIONS: Record<Exclude<TimestampStyle, 'R'>, Intl.DateTimeFormatOptions> = {
  t: { hour: 'numeric', minute: '2-digit' },
  T: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  d: { month: '2-digit', day: '2-digit', year: 'numeric' },
  D: { month: 'long', day: 'numeric', year: 'numeric' },
  f: { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  F: {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
};

/** Largest unit that fits the gap; `second` is the floor so a fresh timestamp still reads. */
const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** The style letter from the token, defaulting to 'f'. Anything unknown is treated as default. */
export function timestampStyle(letter: string | undefined): TimestampStyle {
  if (!letter) return DEFAULT_STYLE;
  return letter in ABSOLUTE_OPTIONS || letter === 'R' ? (letter as TimestampStyle) : DEFAULT_STYLE;
}

/** Full weekday + date + time - the unambiguous form shown when a timestamp is hovered. */
export function formatTimestampTooltip(date: Date): string {
  return formatDate(date, ABSOLUTE_OPTIONS.F);
}

/** The timestamp as the reader should see it, in their language and timezone. */
export function formatTimestamp(date: Date, style: TimestampStyle): string {
  if (style === 'R') return formatRelativeTimestamp(date);
  return formatDate(date, ABSOLUTE_OPTIONS[style]);
}

/**
 * "5 minutes ago" / "in 2 months", in the reader's language. `numeric: 'auto'` gets the
 * idiomatic forms for free ("yesterday", "tomorrow", "now" at zero) instead of "1 day ago".
 *
 * `now` is passed in rather than read here so a whole screen of these can be rendered against
 * one clock reading - otherwise each timestamp would call `Date.now()` and disagree at the
 * boundary.
 */
export function formatRelativeTimestamp(date: Date, now: Date = new Date()): string {
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const magnitude = Math.abs(seconds);
  let value = 0;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [candidate, size] of RELATIVE_UNITS) {
    if (magnitude >= size || candidate === 'second') {
      unit = candidate;
      // `Math.round(-0.4)` is -0, which would format as "in 0 seconds"; 0 formats as "now".
      const rounded = Math.round(seconds / size);
      value = rounded === 0 ? 0 : rounded;
      break;
    }
  }
  try {
    return new Intl.RelativeTimeFormat(currentLanguage(), { numeric: 'auto' }).format(value, unit);
  } catch {
    // A runtime without RelativeTimeFormat still gets a readable absolute timestamp.
    return formatDate(date, ABSOLUTE_OPTIONS.f);
  }
}