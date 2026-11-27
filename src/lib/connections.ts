import { isApiError } from '../api/ApiError';
import { isConnectionProvider } from '../api/connections';
import { t } from '../i18n';
import { translateCaughtApiError } from './formatApiError';

/** A Font Awesome class for a connection's provider. */
export function connectionIcon(provider: string): string {
  switch (provider) {
    case 'domain':
      return 'fa-solid fa-globe';
    case 'fediverse':
      return 'fa-brands fa-mastodon';
    case 'bluesky':
      return 'fa-brands fa-bluesky';
    case 'github':
      return 'fa-brands fa-github';
    case 'discord':
      return 'fa-brands fa-discord';
    default:
      return 'fa-solid fa-link';
  }
}

/** A provider's name ("Website", "GitHub"); an unknown one from another instance as it came. */
export function connectionLabel(provider: string): string {
  return isConnectionProvider(provider) ? t(`connections.providers.${provider}`) : provider;
}

const KNOWN_ERRORS = new Set([
  'unreachable',
  'signed_fetch',
  'mismatch',
  'connection_claimed',
  'connection_limit',
  'challenge_expired',
  'denied',
  'invalid_identifier',
  'provider_disabled',
  'provider_error',
]);

/** What to say for a code from the server or the OAuth landing (`?error=`). */
export function connectionErrorCode(code: string): string {
  if (code === 'proof_not_found' || code === 'proof_not_found_not_found') return t('connections.errors.proof_not_found');
  const plain = code.startsWith('proof_') ? code.slice('proof_'.length) : code;
  if (plain === 'not_found') return t('connections.errors.proof_not_found');
  if (KNOWN_ERRORS.has(plain)) return t(`connections.errors.${plain}`);
  return t('connections.errors.provider_error');
}

/** What to say for a failed call. */
export function connectionErrorText(err: unknown): string {
  if (isApiError(err) && err.code) {
    if (err.code === 'proof_not_found') {
      const reason = typeof err.body?.reason === 'string' ? err.body.reason : 'not_found';
      return connectionErrorCode(reason);
    }
    if (KNOWN_ERRORS.has(err.code)) return connectionErrorCode(err.code);
  }
  return translateCaughtApiError(err, t).join(' ');
}
