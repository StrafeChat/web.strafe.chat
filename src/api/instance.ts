import { api } from './client';

/**
 * Instance-level invites: codes that admit a new *account* to this instance while
 * registration is invite-only. Not to be confused with a space invite, which admits an
 * existing account to a space (`api/spaces.ts`).
 */
export interface InstanceInvite {
  code: string;
  /** Snowflake of the admin who created it; '0' for one that came from configuration. */
  created_by: string;
  note: string;
  /** 0 means unlimited. */
  max_uses: number;
  uses: number;
  expires_at?: string;
  created_at: string;
}

export interface CreateInstanceInviteInput {
  /** 0 means it never expires. */
  max_age_seconds?: number;
  /** 0 means unlimited uses. */
  max_uses?: number;
  note?: string;
}

/** Whether the signed-in account administers this instance. */
export function getInstanceCapabilities() {
  return api<{ instance_admin: boolean }>('/instance/me');
}

export function listInstanceInvites() {
  return api<InstanceInvite[]>('/instance/invites');
}

export function createInstanceInvite(input: CreateInstanceInviteInput = {}) {
  return api<InstanceInvite>('/instance/invites', { method: 'POST', json: input });
}

export function revokeInstanceInvite(code: string) {
  return api<void>(`/instance/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

/**
 * Whether a code would be accepted, without spending it. Unauthenticated, because it runs
 * on the registration page; the server rate-limits it so it cannot be used to guess codes.
 */
export function checkInstanceInvite(code: string) {
  return api<{ valid: boolean }>(`/instance/invites/${encodeURIComponent(code)}/check`);
}
