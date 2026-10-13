/**
 * The emoji picker's "Recently used" row: 'u:<unicode>' and 'c:<custom emoji id>' keys, newest
 * first, kept in localStorage. Its own module so signing out can clear it without the auth
 * store reaching into a component.
 */

const RECENT_KEY = 'strafe_emoji_recent';
const RECENT_MAX = 32;

export function loadRecentEmoji(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentEmoji(key: string): void {
  try {
    const next = [key, ...loadRecentEmoji().filter((k) => k !== key)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Sign-out: the custom emoji in it come from the spaces of the account that is leaving. */
export function clearRecentEmoji(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}
