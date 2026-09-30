import { api } from './client';
import type { PasskeyRegistrationResponse } from '../lib/webauthn';

/**
 * Account security: TOTP authenticator app, passkeys/security keys, and the recovery
 * codes that back both up. Distinct from the login-time calls in api/auth.ts (those resolve
 * an mfa_token before there is a session at all; these manage an already-signed-in
 * account's own settings, mirroring equinox's /auth/2fa/* vs /users/@me/2fa/* split).
 */

export interface WebAuthnCredentialView {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
}

export interface TwoFactorStatus {
  totp_enabled: boolean;
  webauthn_credentials: WebAuthnCredentialView[];
  recovery_codes_remaining: number;
}

export function getTwoFactorStatus() {
  return api<TwoFactorStatus>('/users/@me/2fa');
}

export interface TotpSetupResponse {
  secret: string;
  otpauth_url: string;
}

export function setupTotp() {
  return api<TotpSetupResponse>('/users/@me/2fa/totp/setup', { method: 'POST' });
}

/** recovery_codes is only non-null the first time any second factor is enabled on the
 * account - a later passkey added after TOTP, say, reuses the existing set. */
export interface RecoveryCodesResult {
  recovery_codes: string[] | null;
}

export function enableTotp(code: string) {
  return api<RecoveryCodesResult>('/users/@me/2fa/totp/enable', { method: 'POST', json: { code } });
}

export function disableTotp(password: string) {
  return api<{ ok: true }>('/users/@me/2fa/totp/disable', { method: 'POST', json: { password } });
}

export function beginPasskeyRegistration() {
  return api<{ publicKey: PublicKeyCredentialCreationOptionsJSON }>('/users/@me/2fa/webauthn/register/begin', {
    method: 'POST',
  });
}

export function finishPasskeyRegistration(name: string, credential: PasskeyRegistrationResponse) {
  return api<RecoveryCodesResult>(`/users/@me/2fa/webauthn/register/finish?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    json: credential,
  });
}

export function deletePasskey(credentialId: string, password: string) {
  return api<{ ok: true }>(`/users/@me/2fa/webauthn/${encodeURIComponent(credentialId)}`, {
    method: 'DELETE',
    json: { password },
  });
}

export function regenerateRecoveryCodes(password: string) {
  return api<{ recovery_codes: string[] }>('/users/@me/2fa/recovery_codes/regenerate', {
    method: 'POST',
    json: { password },
  });
}
