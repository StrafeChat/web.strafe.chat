/**
 * Birthday formatting.
 *
 * A birthday is a `"MM-DD"` string with no year - the year is the one thing nobody
 * broadcasts about their birthday, so the API never sends it. Everything here therefore
 * renders month + day only, and resolves against a fixed leap year with the date pinned to
 * midday UTC: that keeps a Feb 29 birthday rendering (a plain `new Date(y, 1, 29)` in a
 * non-leap year silently rolls into March 1st) and keeps the result from shifting a day
 * backwards in timezones west of UTC.
 */

import { formatDate } from '../../i18n';

/** Year used only to format month + day; 2000 is a leap year, so `02-29` survives. */
const DISPLAY_YEAR = 2000;

function parseMonthDay(value: string | undefined | null): { month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return null;
  // Rejects impossible dates (02-30) that would otherwise be normalised by `Date`.
  const probe = new Date(Date.UTC(DISPLAY_YEAR, month - 1, day, 12));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { month, day };
}

/**
 * `"09-01"` -> "September 1" in the UI language (e.g. "1 de septiembre", "1 سبتمبر").
 * Returns undefined for an absent or unparseable value so callers can simply not render.
 */
export function formatBirthday(value: string | undefined | null): string | undefined {
  const md = parseMonthDay(value);
  if (!md) return undefined;
  return formatDate(new Date(Date.UTC(DISPLAY_YEAR, md.month - 1, md.day, 12)), {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Whether `"MM-DD"` is today. Compared in UTC because that is where the server decides
 * which members to announce - a birthday that flips at local midnight in the client would
 * put the 🎂 on the wrong day for most of the world.
 */
export function isBirthdayToday(value: string | undefined | null): boolean {
  const md = parseMonthDay(value);
  if (!md) return false;
  const now = new Date();
  return md.month === now.getUTCMonth() + 1 && md.day === now.getUTCDate();
}

/**
 * The server sends `is_birthday` with the public user object, but fall back to comparing
 * the date ourselves so the indicator still works on payloads that only carry `birthday`
 * (and for the owner, who never gets `is_birthday` - their own `/users/@me` is self-only).
 */
export function birthdayIsToday(
  birthday: string | undefined | null,
  serverFlag?: boolean
): boolean {
  return typeof serverFlag === 'boolean' ? serverFlag : isBirthdayToday(birthday);
}
