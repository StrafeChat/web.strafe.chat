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

// ---- moderation ------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  home_domain?: string;
  email?: string;
  created_at?: string;
  bot?: boolean;
  verified_email?: boolean;
  /** Profile-badge bitfield (see lib/badges.ts). */
  public_flags?: number;
}

export interface AdminSpace {
  id: string;
  name: string;
  icon?: string;
  owner_id: string;
  official?: boolean;
  created_at: string;
}

export interface InstanceBan {
  user_id: string;
  banned_by: string;
  reason: string;
  created_at: string;
  expires_at?: string;
}

export interface AdminSession {
  session_id: string;
  created_at: string;
  expires_at: string;
  ip_address: string;
  user_agent: string;
}

export interface ReportSummary {
  id: string;
  target_type: 'user' | 'space';
  target_id: string;
  reporter_id: string;
  status: ReportStatus;
  reason: ReportReason;
  created_at: string;
}

export interface UserDetail {
  user: AdminUser;
  ban: InstanceBan | null;
  instance_admin: boolean;
  sessions: AdminSession[];
  spaces: AdminSpace[];
  reports: ReportSummary[];
}

export interface SpaceDetail {
  space: AdminSpace;
  owner: AdminUser | null;
  member_count: number;
  reports: ReportSummary[];
}

export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'illegal' | 'impersonation' | 'other';
/** Must match instance.ReportReasons on the server. */
export const REPORT_REASONS: ReportReason[] = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'illegal', 'impersonation', 'other'];

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'user' | 'space';
  target_id: string;
  space_id?: string;
  room_id?: string;
  message_id?: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  created_at: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution?: 'none' | 'banned' | 'space_removed';
  resolution_note?: string;
}

export interface ReportRow {
  report: Report;
  reporter: AdminUser | null;
  target_user?: AdminUser | null;
  target_space?: AdminSpace | null;
}

export interface ReportDetail extends ReportRow {
  room?: { id: string; name: string; type: number };
  message?: {
    id: string;
    sender_id: string;
    created_at: string;
    /** True when the server could read it (a plaintext room, not deleted). */
    readable: boolean;
    deleted: boolean;
    text?: string;
  };
}

export type ResolveAction = 'dismiss' | 'resolve' | 'ban_user' | 'remove_space';

export interface AuditRow {
  entry: {
    id: string;
    actor_id: string;
    action: string;
    target_type: string;
    target_id: string;
    reason?: string;
    created_at: string;
  };
  actor: AdminUser | null;
}

export interface InstanceStats {
  open_reports: number;
  bans: number;
  invites: number;
  invite_only: boolean;
  /** Instance-wide counts; -1 means the server could not determine it right now. */
  accounts: number;
  online: number;
  spaces: number;
}

export function getInstanceStats() {
  return api<InstanceStats>('/instance/stats');
}

export function searchUsers(q: string) {
  return api<AdminUser[]>(`/instance/users?q=${encodeURIComponent(q)}`);
}

export function getUserDetail(userId: string) {
  return api<UserDetail>(`/instance/users/${encodeURIComponent(userId)}`);
}

export function banUser(userId: string, input: { reason?: string; max_age_seconds?: number }) {
  return api<InstanceBan>(`/instance/users/${encodeURIComponent(userId)}/ban`, { method: 'POST', json: input });
}

export function unbanUser(userId: string) {
  return api<void>(`/instance/users/${encodeURIComponent(userId)}/ban`, { method: 'DELETE' });
}

export interface RecoveryCodesResult {
  /** The new recovery codes, present only when they were NOT emailed (so the admin can relay
   * them). Null/absent when they were emailed to the user. */
  codes: string[] | null;
  emailed: boolean;
}

/** Admin: regenerate a user's 2FA recovery codes. Emails them to the user when email is
 * configured; otherwise returns them for the admin to hand over. The old codes stop working. */
export function regenerateUserRecoveryCodes(userId: string) {
  return api<RecoveryCodesResult>(`/instance/users/${encodeURIComponent(userId)}/recovery_codes`, {
    method: 'POST',
  });
}

export function setUserBadges(userId: string, flags: number) {
  return api<{ public_flags: number }>(`/instance/users/${encodeURIComponent(userId)}/badges`, {
    method: 'PATCH',
    json: { flags },
  });
}

export function listBans() {
  return api<{ ban: InstanceBan; user: AdminUser | null }[]>('/instance/bans');
}

export function getSpaceDetail(spaceId: string) {
  return api<SpaceDetail>(`/instance/spaces/${encodeURIComponent(spaceId)}`);
}

/** Mark a space as official (part of this instance) or clear it. Admin only. */
export function setSpaceOfficial(spaceId: string, official: boolean) {
  return api<{ official: boolean }>(`/instance/spaces/${encodeURIComponent(spaceId)}/official`, {
    method: 'PATCH',
    json: { official },
  });
}

export function takeDownSpace(spaceId: string, reason: string) {
  return api<void>(`/instance/spaces/${encodeURIComponent(spaceId)}`, { method: 'DELETE', json: { reason } });
}

export function listReports(status: ReportStatus) {
  return api<ReportRow[]>(`/instance/reports?status=${status}`);
}

export function getReport(reportId: string) {
  return api<ReportDetail>(`/instance/reports/${encodeURIComponent(reportId)}`);
}

export function resolveReport(reportId: string, input: { action: ResolveAction; note?: string; max_age_seconds?: number }) {
  return api<Report>(`/instance/reports/${encodeURIComponent(reportId)}/resolve`, { method: 'POST', json: input });
}

export function listAudit() {
  return api<AuditRow[]>('/instance/audit');
}

// ---- federation allow/block list -------------------------------------------------------

export interface PeerPolicyRow {
  domain: string;
  /** Snowflake of the admin who added it. */
  added_by: string;
  created_at: string;
}

export interface FederationPolicy {
  /** Whether this instance federates at all (FEDERATION_DOMAIN set). */
  enabled: boolean;
  /** This instance's own domain. */
  domain: string;
  /** Editable, admin-managed entries. */
  allow: PeerPolicyRow[];
  block: PeerPolicyRow[];
  /** Read-only entries from FEDERATION_ALLOWLIST / FEDERATION_BLOCKLIST (environment). */
  env_allow: string[];
  env_block: string[];
}

/** Admin: the instance's federation allow/block list plus the read-only env lists. */
export function listFederationPolicy() {
  return api<FederationPolicy>('/instance/federation/policy');
}

/** Admin: allow or block a peer instance domain. A non-empty allowlist = allowlist-only mode. */
export function setFederationPolicy(domain: string, kind: 'allow' | 'block') {
  return api<void>('/instance/federation/policy', { method: 'POST', json: { domain, kind } });
}

/** Admin: remove a peer instance domain's rule. */
export function removeFederationPolicy(domain: string) {
  return api<void>(`/instance/federation/policy/${encodeURIComponent(domain)}`, { method: 'DELETE' });
}
