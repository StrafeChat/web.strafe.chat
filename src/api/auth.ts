import { api } from './client';
import type { User } from '../types/api';
import type { PasskeyAssertionResponse } from '../lib/webauthn';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Pick<User, 'id' | 'username' | 'discriminator' | 'display_name'>;
}

/** What POST /auth/login returns instead of a session when the account has a second factor
 * enabled - still a 200, since needing another step isn't an error. */
export interface MFAChallengeResponse {
  mfa_required: true;
  mfa_token: string;
  methods: ('totp' | 'webauthn')[];
}

export type LoginResult = LoginResponse | MFAChallengeResponse;

export function isMFAChallenge(res: LoginResult): res is MFAChallengeResponse {
  return (res as MFAChallengeResponse).mfa_required === true;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  date_of_birth: string;
  discriminator?: number;
  /** Challenge response; required only by instances that enabled a captcha. */
  captcha_token?: string;
  /** Instance invite code. Required only by invite-only instances, and not even then for
   * the very first account - there is nobody to have issued one yet. */
  invite?: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  username: string;
  discriminator: number;
  display_name: string;
  created_at: string;
}

export function login(input: LoginInput) {
  return api<LoginResult>('/auth/login', {
    method: 'POST',
    json: input,
  });
}

export interface MFACodeInput {
  mfa_token: string;
  code: string;
}

export function verifyTotp(input: MFACodeInput) {
  return api<LoginResponse>('/auth/2fa/totp', { method: 'POST', json: input });
}

export function verifyRecoveryCode(input: MFACodeInput) {
  return api<LoginResponse>('/auth/2fa/recovery', { method: 'POST', json: input });
}

/** The mfa_token travels as a header rather than the body, leaving the body free for the
 * raw WebAuthn payload on both these calls (see equinox's handler_2fa.go for why). */
export function beginWebauthnLogin(mfaToken: string) {
  return api<{ publicKey: PublicKeyCredentialRequestOptionsJSON }>('/auth/2fa/webauthn/begin', {
    method: 'POST',
    headers: { 'X-MFA-Token': mfaToken },
  });
}

export function finishWebauthnLogin(mfaToken: string, credential: PasskeyAssertionResponse) {
  return api<LoginResponse>('/auth/2fa/webauthn/finish', {
    method: 'POST',
    headers: { 'X-MFA-Token': mfaToken },
    json: credential,
  });
}

export function register(input: RegisterInput) {
  return api<RegisterResponse>('/auth/register', {
    method: 'POST',
    json: input,
  });
}
