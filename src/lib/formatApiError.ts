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
  'this room already has the maximum of 50 pinned messages': 'errors.api.tooManyPins',
  'missing permission to pin messages in this channel': 'errors.api.pinForbidden',
  'this thread is locked': 'errors.api.threadLocked',
  'this thread is archived': 'errors.api.threadArchived',
  'this space already has the maximum number of active threads': 'errors.api.tooManyThreads',
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
  // An origin older than the op a mirror forwarded. The only member-facing op new enough to
  // meet one in practice is member.profile (space profiles), hence the wording.
  'unknown action': 'errors.api.spaceProfileUnsupported',
  // Space profiles (spaces/member_profile.go) and the space moderation errors they share.
  // The about_me / bio / pronouns lines are also the global profile's own (users/schema.go).
  'nickname must be at most 32 characters, on one line': 'errors.api.nicknameInvalid',
  'missing permission to change your nickname in this space': 'errors.api.nicknameForbidden',
  "only the space owner can change the owner's nickname": 'errors.api.ownerNicknameForbidden',
  "only the space owner can change the owner's space profile": 'errors.api.ownerSpaceProfileForbidden',
  'only the member can change their own space avatar, banner, pronouns, about me or bio': 'errors.api.spaceProfileNotOwn',
  'avatar and banner must be uploaded, or cleared with null': 'errors.api.spaceProfileImage',
  'about_me must be at most 190 characters': 'errors.api.aboutMeTooLong',
  'bio must be at most 190 characters': 'errors.api.bioTooLong',
  'pronouns must be at most 40 characters': 'errors.api.pronounsTooLong',
  'member not found': 'errors.api.memberNotFound',
  'cannot manage a role or member at or above your own highest role': 'errors.api.roleHierarchy',
  'missing permission': 'errors.api.missingPermission',
  // A 409: two writes (normally two uploads at once) raced and this one lost twice.
  'the space profile changed while saving; try again': 'errors.api.spaceProfileChanged',
  // Image uploads judge the type by extension, so an image/* the picker let through (HEIC,
  // BMP) can still be refused here.
  'unsupported image type (use jpg, png, gif, or webp)': 'settings.profile.imageTypeError',
  // The rest of every image upload's refusals (profile, space profile, space icon and banner).
  'invalid file size': 'settings.profile.imageSizeError',
  'could not read file': 'settings.profile.uploadFailed',
  'could not store image': 'settings.profile.uploadFailed',
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

  // The whole message first: a server sentence may itself contain "; " (the space-profile
  // 409, the federation-off hint), and split into halves it would match nothing.
  const whole = SERVER_MESSAGE_TO_KEY[n.toLowerCase()] ?? SERVER_MESSAGE_TO_KEY[n];
  if (whole) return [t(whole)];

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
  // A moderator sent a value (not a clear) for someone else's space avatar, banner, pronouns,
  // About Me or bio: only the member sets those.
  if (isApiError(err) && err.code === 'cannot_edit_member_profile') {
    return [t('errors.api.spaceProfileNotOwn')];
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
