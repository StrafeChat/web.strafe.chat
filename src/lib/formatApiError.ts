import { isApiError } from '../api/ApiError';

/** Subset of i18next `t` — avoids branded `TFunction` so wrappers (e.g. `useReactiveTranslate`) type-check. */
export type ErrorTranslateFn = (key: string, options?: Record<string, string>) => string;

/**
 * Maps exact backend / validation strings (English) to i18n keys under errors.api.*
 * Keep in sync with equinox auth handler + zog schema messages.
 */
const SERVER_MESSAGE_TO_KEY: Record<string, string> = {
  // Auth handler
  'invalid email or password': 'errors.api.invalidCredentials',
  'internal error': 'errors.api.internal',
  unauthorized: 'errors.api.unauthorized',
  'invite-only mode enabled': 'errors.api.inviteOnly',
  'email already in use': 'errors.api.emailInUse',
  'discriminator already in use for this username': 'errors.api.discriminatorInUse',
  'password does not meet requirements': 'errors.api.weakPassword',
  'invalid username': 'errors.api.invalidUsername',
  'validation failed': 'errors.api.validationFailed',
  // Zog login
  'email must be valid': 'errors.validation.emailInvalid',
  'email is required': 'errors.validation.emailRequired',
  'password is required': 'errors.validation.passwordRequired',
  // Zog register
  'username must be at least 2 characters': 'errors.validation.usernameMin',
  'username must be at most 32 characters': 'errors.validation.usernameMax',
  'username is required': 'errors.validation.usernameRequired',
  'password must be at least 8 characters': 'errors.validation.passwordMin8',
};

function normalizeSegment(seg: string): string {
  return seg.trim().replace(/\s+/g, ' ');
}

function translateSegment(seg: string, t: ErrorTranslateFn): string {
  const n = normalizeSegment(seg);
  const lower = n.toLowerCase();
  const key = SERVER_MESSAGE_TO_KEY[lower] ?? SERVER_MESSAGE_TO_KEY[n];
  if (key) return t(key);

  // "field: validation failed" from backend
  const colon = n.indexOf(':');
  if (colon > 0) {
    const rest = normalizeSegment(n.slice(colon + 1)).toLowerCase();
    const k2 = SERVER_MESSAGE_TO_KEY[rest];
    if (k2) return t(k2);
  }

  return n;
}

/**
 * Split combined validation messages ("a; b") into separate user-facing lines.
 */
export function splitErrorMessage(raw: string): string[] {
  return raw
    .split(/;\s*/)
    .map((s) => normalizeSegment(s))
    .filter(Boolean);
}

export function translateApiErrorMessage(raw: string, t: ErrorTranslateFn): string[] {
  const n = normalizeSegment(raw);

  if (/^failed to fetch$/i.test(n) || /networkerror when attempting to fetch resource/i.test(n)) {
    return [t('errors.network')];
  }

  const httpOnly = /^HTTP (\d{3})$/.exec(n);
  if (httpOnly) {
    const code = httpOnly[1];
    return [t('errors.api.httpStatus', { status: code })];
  }

  return splitErrorMessage(n).map((seg) => translateSegment(seg, t));
}

export function translateCaughtApiError(err: unknown, t: ErrorTranslateFn): string[] {
  if (isApiError(err) && err.status === 429) {
    return [t('errors.api.rateLimited')];
  }
  if (isApiError(err)) {
    return translateApiErrorMessage(err.message, t);
  }
  if (err instanceof Error) {
    return translateApiErrorMessage(err.message, t);
  }
  return [t('errors.unknown')];
}
