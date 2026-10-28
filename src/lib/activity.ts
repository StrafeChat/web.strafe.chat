/**
 * Game activity ("Playing X") - the parts every client shares: the shape, how a name from the
 * wire is made safe to show, and how long someone has been playing.
 *
 * Plain TypeScript with no Solid or JSX, so the mobile app (which runs the web client's stores
 * but draws its own UI) can use the same rules.
 *
 * A name comes from another person's desktop app, possibly through another instance, so it is
 * untrusted text: the server already cleans it, and this cleans it again. It is always shown as
 * plain text inside a <bdi> (or dir="auto"), never as markdown, emoji, mentions or a link.
 */

/** What someone is doing. v1 knows one type. */
export interface Activity {
  type: 'playing';
  /** The game's name, 1..128 code points after cleaning. */
  name: string;
  /** Unix ms the game started, when known. */
  started_at?: number;
}

/** Longest name, counted in code points (the server counts runes, which is the same). */
export const ACTIVITY_NAME_MAX = 128;

// Never allowed anywhere: control characters, the line and paragraph separators (they break
// the line), and the bidi embeddings, overrides and isolates (they reverse how the text after
// them reads). Joiners (U+200D) and variation selectors (U+FE0F) stay: emoji need them.
const FORBIDDEN = /[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/gu;
// Something that renders: not a space, an invisible format character, a lone combining mark,
// or one of the letters that draw as nothing (Hangul fillers, the blank braille pattern).
const VISIBLE = /[^\s\p{Cf}\p{Mn}\p{Me}\u115F\u1160\u3164\uFFA0\u2800]/u;

/**
 * A game name cleaned the way the server cleans it: forbidden characters removed, runs of
 * whitespace collapsed to one space, trimmed, at most `ACTIVITY_NAME_MAX` code points. Null
 * when nothing visible is left. Also what the Settings page checks a rename against.
 */
export function cleanActivityName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(FORBIDDEN, '').replace(/\s+/gu, ' ').trim();
  if (!s || !VISIBLE.test(s)) return null;
  const points = [...s];
  return points.length > ACTIVITY_NAME_MAX ? points.slice(0, ACTIVITY_NAME_MAX).join('').trim() : s;
}

/** Whether a name typed by the person is one the shell and the server will take as it is. */
export function validActivityName(raw: string): boolean {
  const s = raw.replace(FORBIDDEN, '').replace(/\s+/gu, ' ').trim();
  return !!s && VISIBLE.test(s) && [...s].length <= ACTIVITY_NAME_MAX;
}

/**
 * The `activities` of a presence payload as this client keeps them: the first well-formed
 * entry only (one activity at a time), or undefined when there is none. Anything malformed is
 * dropped rather than shown.
 */
export function normalizeActivities(raw: unknown): Activity[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (o.type !== 'playing') continue;
    const name = cleanActivityName(o.name);
    if (!name) continue;
    const at = typeof o.started_at === 'number' && Number.isFinite(o.started_at) && o.started_at > 0 ? Math.floor(o.started_at) : 0;
    return [at ? { type: 'playing', name, started_at: at } : { type: 'playing', name }];
  }
  return undefined;
}

/** Same activity (type, name and start), so an unchanged one is not written again. */
export function sameActivity(a: Activity | null | undefined, b: Activity | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.type === b.type && a.name === b.name && (a.started_at ?? 0) === (b.started_at ?? 0);
}

export function sameActivities(a: Activity[] | undefined, b: Activity[] | undefined): boolean {
  const la = a?.length ?? 0;
  const lb = b?.length ?? 0;
  if (la !== lb) return false;
  for (let i = 0; i < la; i += 1) if (!sameActivity(a![i], b![i])) return false;
  return true;
}

/**
 * How long someone has been playing, in the reader's language: "1 hr 2 min", "45 min".
 * Whole minutes, at least one (a game started seconds ago reads "1 min", not "0 min"); hours
 * from sixty minutes on. A sender's clock running ahead of ours never makes it negative.
 *
 * Built from `Intl.NumberFormat` unit styles so no plural keys are needed. Where an engine
 * lacks unit formatting - it throws, or quietly formats a bare number (some embedded engines
 * ignore options they do not know) - it falls back to "h:mm".
 */
export function formatActivityDuration(elapsedMs: number, locale: string): string {
  const total = Math.max(1, Math.floor((Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0) / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  try {
    const parts: string[] = [];
    if (hours > 0) parts.push(formatUnit(locale, 'hour', hours));
    if (minutes > 0 || hours === 0) parts.push(formatUnit(locale, 'minute', minutes));
    if (parts.length < 2) return parts[0];
    try {
      return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(parts);
    } catch {
      return parts.join(' ');
    }
  } catch {
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }
}

/** "2 hr", "5 min" - or a throw when the engine cannot put a unit on a number. */
function formatUnit(locale: string, unit: 'hour' | 'minute', n: number): string {
  const s = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(n);
  if (s === new Intl.NumberFormat(locale).format(n)) throw new RangeError('no unit formatting');
  return s;
}
