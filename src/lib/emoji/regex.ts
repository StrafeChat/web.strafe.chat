/**
 * Unicode emoji detection.
 *
 * One sequence = one rendered glyph, covering: flags (two regional indicators), keycaps
 * (digit/#/* + optional VS16 + U+20E3), tag sequences (🏴 + tag characters, e.g. the
 * subdivision flags), and pictographs with optional skin-tone modifier / VS16, joined
 * into ZWJ sequences (families, professions, 🏳️‍🌈…).
 *
 * Pictographs whose default presentation is *text* (©, ®, ™, ↔, ☀, …) only count when
 * followed by VS16 (U+FE0F) or a modifier/ZWJ - the same rule Twemoji applies, so plain
 * "(c)" style characters in prose stay as text.
 */
const PICTO_EMOJI = '\\p{Emoji_Presentation}';
const PICTO_TEXT_WITH_VS = '\\p{Extended_Pictographic}\\uFE0F';
const MODIFIER = '\\p{Emoji_Modifier}';
const TAGS = '[\\u{E0020}-\\u{E007E}]+\\u{E007F}';

const UNIT = `(?:${PICTO_EMOJI}|${PICTO_TEXT_WITH_VS}|\\p{Extended_Pictographic}(?=${MODIFIER}|\\u200D))(?:${MODIFIER})?(?:\\uFE0F)?(?:${TAGS})?`;
const KEYCAP = '[0-9#*]\\uFE0F?\\u20E3';
const FLAG = '\\p{Regional_Indicator}{2}';

const SOURCE = `(?:${FLAG})|(?:${KEYCAP})|(?:${UNIT}(?:\\u200D${UNIT})*)`;

/** Global matcher - use with `matchAll` / `replace`. */
export const EMOJI_REGEX = new RegExp(SOURCE, 'gu');
/** Sticky matcher for "is there an emoji starting exactly at index i" scans. */
export const EMOJI_REGEX_STICKY = new RegExp(SOURCE, 'yu');
/** Anchored full-string test. */
const EMOJI_ONLY = new RegExp(`^(?:${SOURCE})$`, 'u');

export function isSingleEmoji(s: string): boolean {
  return EMOJI_ONLY.test(s);
}

/** Emoji starting exactly at `index`, or null. */
export function emojiAt(text: string, index: number): string | null {
  EMOJI_REGEX_STICKY.lastIndex = index;
  const m = EMOJI_REGEX_STICKY.exec(text);
  return m ? m[0] : null;
}

/** Cheap pre-check before running the full matcher on a string. */
export function mayContainEmoji(text: string): boolean {
  // Everything an emoji sequence can start with lies outside the Latin-1 range except
  // keycap bases, which need the U+20E3 combiner to count anyway.
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 0xff || c === 0x20e3) return true;
  }
  return false;
}
