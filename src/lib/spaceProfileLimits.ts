/**
 * The server's rules for a space profile's text (equinox spaces/member_profile.go), checked
 * while a draft is typed so the form can say what is wrong and hold back the save, instead of
 * sending a value it already knows will be refused. The server decides either way.
 *
 * Lengths are code points of the trimmed value, which is what the server counts
 * (utf8.RuneCountInString after strings.TrimSpace). An input's maxLength counts UTF-16 units
 * instead, so one emoji used two of them and a 32-character nickname of emoji stopped at 16:
 * fields take `inputMaxLength` (twice the limit, a paste guard that admits every value the
 * server would) and show `spaceProfileFieldError`.
 */
export const SPACE_PROFILE_LIMITS = { nick: 32, pronouns: 40, aboutMe: 190, bio: 190 } as const;

export type SpaceProfileTextField = keyof typeof SPACE_PROFILE_LIMITS;

/** The i18n key for each field's refusal - the same lines the server's errors map to. */
const ERROR_KEY: Record<SpaceProfileTextField, string> = {
  nick: 'errors.api.nicknameInvalid',
  pronouns: 'errors.api.pronounsTooLong',
  aboutMe: 'errors.api.aboutMeTooLong',
  bio: 'errors.api.bioTooLong',
};

/** For a field's maxLength: a UTF-16 cap that every value within the limit fits under. */
export function inputMaxLength(field: SpaceProfileTextField): number {
  return SPACE_PROFILE_LIMITS[field] * 2;
}

/** Characters as the server counts them: code points, after trimming. */
export function profileTextLength(value: string): number {
  return Array.from(value.trim()).length;
}

// validNickname: control characters (newlines, tabs), the line and paragraph separators and
// the bidi embeddings, overrides and isolates are refused anywhere in a nickname...
const NICKNAME_FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}‪-‮⁦-⁩]/u;
// ...and so is one made only of blanks, invisible formatting, combining marks and the blank
// fillers (Hangul fillers, the empty braille pattern).
const NICKNAME_INVISIBLE = /^[\p{White_Space}\p{Cf}\p{Mn}\p{Me}ᅟᅠㅤﾠ⠀]*$/u;

/**
 * The i18n key of the reason the server would refuse this draft, or undefined when it would
 * take it. Empty (after trimming) is always fine: it clears the field.
 */
export function spaceProfileFieldError(field: SpaceProfileTextField, value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (profileTextLength(v) > SPACE_PROFILE_LIMITS[field]) return ERROR_KEY[field];
  if (field === 'nick' && (NICKNAME_FORBIDDEN.test(v) || NICKNAME_INVISIBLE.test(v))) return ERROR_KEY.nick;
  return undefined;
}
