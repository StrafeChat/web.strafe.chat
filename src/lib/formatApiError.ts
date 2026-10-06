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
  'an invite code is required to register on this instance': 'errors.api.inviteRequired',
  'that invite code is not valid': 'errors.api.inviteInvalid',
  'account is banned': 'errors.api.banned',
  'email already in use': 'errors.api.emailInUse',
  'enter a valid email address': 'errors.validation.emailInvalid',
  'disposable email addresses cannot be used here - use a permanent address': 'errors.api.disposableEmail',
  'this network is banned from this instance': 'errors.api.ipBanned',
  'username already taken': 'errors.api.usernameTaken',
  'password does not meet requirements': 'errors.api.weakPassword',
  'invalid username': 'errors.api.invalidUsername',
  'validation failed': 'errors.api.validationFailed',
  // Two-factor auth
  'mfa session expired or invalid, please log in again': 'errors.api.mfaTokenInvalid',
  'too many attempts, please log in again': 'errors.api.mfaTooManyAttempts',
  'invalid authenticator code': 'errors.api.invalidTotpCode',
  'invalid or already-used recovery code': 'errors.api.invalidRecoveryCode',
  'passkey verification failed': 'errors.api.invalidPasskeyResponse',
  'authenticator app is already enabled': 'errors.api.totpAlreadyEnabled',
  'authenticator app is not enabled': 'errors.api.totpNotEnabled',
  'passkeys are not configured on this instance': 'errors.api.webauthnNotConfigured',
  'passkey not found': 'errors.api.passkeyNotFound',
  // Email verification / password reset
  'email not verified': 'errors.api.emailUnverified',
  'email is not configured on this instance': 'errors.api.emailDisabled',
  'email is already verified': 'errors.api.emailAlreadyVerified',
  'please wait a minute before requesting another email': 'errors.api.emailCooldown',
  'that verification link is not valid or has expired': 'errors.api.emailTokenInvalid',
  'that password reset link is not valid or has expired': 'errors.api.resetTokenInvalid',
  // Friend requests (relationships handler) and the handle lookup behind them
  'user not found': 'errors.api.userNotFound',
  'cannot send request to yourself': 'errors.api.friendRequestSelf',
  'bots cannot be added as friends': 'errors.api.friendRequestBot',
  'already friends': 'errors.api.alreadyFriends',
  'request already sent': 'errors.api.friendRequestExists',
  'you cannot add this user': 'errors.api.cannotAddUser',
  'expected a username': 'errors.api.invalidHandle',
  'invalid handle - expected name@domain': 'errors.api.invalidHandle',
  'this instance does not federate; use a local username': 'errors.api.federationOff',
  'no such user on that instance': 'errors.api.federationUserNotFound',
  'the other instance could not be reached': 'errors.api.federationUnreachable',
  'the other instance refused the request': 'errors.api.federationRefused',
  "that instance is not allowed by this server's federation policy": 'errors.api.federationPeerNotAllowed',
  // Spaces hosted on another instance
  'this space is hosted on another instance and can only be managed from there': 'errors.api.spaceHostedElsewhere',
  'the instance hosting this space could not be reached': 'errors.api.spaceOriginUnreachable',
  'this instance does not federate with other instances': 'errors.api.federationOff',
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

/** Space automod rules (messages/automod.go) → the line the composer shows. */
const AUTOMOD_RULE_KEY: Record<string, string> = {
  repeated: 'errors.api.automodRepeated',
  invite: 'errors.api.automodInvite',
  mentions: 'errors.api.automodMentions',
};

/** Verification-level requirements the sender does not meet yet → the line the composer shows. */
const VERIFICATION_REQUIREMENT_KEY: Record<string, string> = {
  email: 'errors.api.verificationEmail',
  account_age: 'errors.api.verificationAccountAge',
  member_age: 'errors.api.verificationMemberAge',
};

export function translateCaughtApiError(err: unknown, t: ErrorTranslateFn): string[] {
  // A burned pending login is a 429 too, but it means "log in again", not "slow down" -
  // branch on the wire code before the status collapses it into the generic rate limit.
  if (isApiError(err) && err.code === 'mfa_too_many_attempts') {
    return [t('errors.api.mfaTooManyAttempts')];
  }
  // A space's automod / verification level refused the message: the code names the rule or
  // requirement, which is what the person can act on.
  if (isApiError(err) && err.code === 'automod_blocked') {
    const key = AUTOMOD_RULE_KEY[String(err.body?.rule ?? '')];
    if (key) return [t(key)];
  }
  if (isApiError(err) && err.code === 'verification_level') {
    const key = VERIFICATION_REQUIREMENT_KEY[String(err.body?.requirement ?? '')];
    if (key) return [t(key)];
  }
  if (isApiError(err) && err.code === 'ip_banned') {
    return [t('errors.api.ipBanned')];
  }
  // Likewise a 429 that means "one was just sent", not "slow down".
  if (isApiError(err) && err.code === 'email_cooldown') {
    return [t('errors.api.emailCooldown')];
  }
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
