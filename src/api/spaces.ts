import { api, getApiUrl } from './client';
import { ApiError } from './ApiError';
import type { RoomParticipant } from './rooms';

export interface Space {
  id: string;
  name: string;
  name_acronym: string;
  description: string;
  icon: string;
  banner: string;
  owner_id: string;
  /** Blessed by an instance admin as part of this instance. */
  official?: boolean;
  /** Raid protection: what a member with no role must satisfy before sending (VERIFICATION_*). */
  verification_level: number;
  /** Light automod: AUTOMOD_* bits, and the mention cap the mass-mention rule uses (0 = default 5). */
  automod_flags?: number;
  automod_mention_limit?: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  features: string[];
  afk_room_id?: string;
  afk_timeout: number;
  system_room_id?: string;
  system_room_flags: number;
  /** Text room the daily birthday greetings are posted in; absent = not celebrated. */
  birthday_channel_id?: string;
  /** Optional template for those greetings; `{user}` is replaced by the member's name. */
  birthday_message?: string;
  rules_room_id?: string;
  max_presences: number;
  max_members: number;
  vanity_url_code: string;
  preferred_locale: string;
  public_updates_room_id?: string;
  max_video_room_users: number;
  /** Server widget: public member/online counts (+ an invite when widget_room_id is set). */
  widget_enabled?: boolean;
  widget_room_id?: string;
  created_at: string;
  updated_at: string;
  everyone_role_id?: string;
  /** Every role in the space, sorted by position. Present on member-facing payloads (READY,
   * GET /spaces, GET /spaces/:id, join) so permissions can be evaluated locally; kept
   * current by SPACE_ROLE_* gateway events. Absent only on the public invite preview. */
  roles?: SpaceRole[];
  /** Set when another instance hosts the space: this is a mirror kept current by that
   * instance (the origin). Members here chat in it like any space, but it can only be
   * managed from the origin. */
  federation?: SpaceFederation;
}

/** A mirrored space's origin: the hosting instance and the id it has there. */
export interface SpaceFederation {
  origin_domain: string;
  origin_id: string;
}

export interface CreateSpaceInput {
  name: string;
  description?: string;
  icon?: string;
}

export function listSpaces() {
  return api<Space[]>('/spaces');
}

export function getSpace(id: string) {
  return api<Space>(`/spaces/${id}`);
}

/** Room ids are strings; an empty string clears the setting. */
export interface PatchSpaceInput {
  name?: string;
  description?: string;
  system_room_id?: string;
  system_room_flags?: number;
  /** Must be a text room in this space; an empty string turns birthday greetings off. */
  birthday_channel_id?: string;
  /** Greeting template, max 500 characters, `{user}` marks where the member is named. */
  birthday_message?: string;
  default_message_notifications?: number;
  afk_room_id?: string;
  afk_timeout?: number;
  widget_enabled?: boolean;
  widget_room_id?: string;
  verification_level?: number;
  automod_flags?: number;
  /** 1-50; 0 means the default of 5. */
  automod_mention_limit?: number;
}

/** spaces.system_room_flags bits - set = that notice is suppressed. */
export const SYSTEM_FLAG_SUPPRESS_JOIN = 1;
export const SYSTEM_FLAG_SUPPRESS_LEAVE = 2;

/** Verification levels (cumulative; members with any role are exempt). Same values as Discord's 0-3. */
export const VERIFICATION_NONE = 0;
export const VERIFICATION_LOW = 1; // verified email
export const VERIFICATION_MEDIUM = 2; // + account older than 5 minutes
export const VERIFICATION_HIGH = 3; // + member for 10 minutes
export const VERIFICATION_LEVELS = [VERIFICATION_NONE, VERIFICATION_LOW, VERIFICATION_MEDIUM, VERIFICATION_HIGH] as const;

/** spaces.automod_flags bits. Content rules only apply in channels the server can read (E2EE off). */
export const AUTOMOD_REPEATED_MESSAGES = 1;
export const AUTOMOD_INVITE_LINKS = 2;
export const AUTOMOD_MASS_MENTIONS = 4;
export const AUTOMOD_DEFAULT_MENTION_LIMIT = 5;
export const AUTOMOD_MAX_MENTION_LIMIT = 50;

/** Accepted afk_timeout values (seconds). */
export const AFK_TIMEOUTS = [60, 300, 900, 1800, 3600] as const;

export function patchSpace(spaceId: string, body: PatchSpaceInput) {
  return api<Space>(`/spaces/${spaceId}`, { method: 'PATCH', json: body });
}

export function createSpace(input: CreateSpaceInput) {
  return api<Space>('/spaces', {
    method: 'POST',
    json: {
      name: input.name.trim(),
      ...(input.description != null && input.description !== '' && { description: input.description.trim() }),
      ...(input.icon != null && input.icon !== '' && { icon: input.icon }),
    },
  });
}

/** Room within a space (section, text channel, or voice channel). */
export interface SpaceRoom {
  id: string;
  type: number; // 3 = text, 4 = voice, 5 = section, 6 = thread
  name: string;
  topic?: string;
  slowmode_seconds?: number;
  position: number;
  space_id?: string;
  parent_id?: string;
  last_message_id?: string;
  last_read_message_id?: string;
  mention_count?: number;
  /** This user's own per-room notification settings - never visible to anyone else. */
  muted?: boolean;
  muted_until?: string;
  /** 0 = follow the global default for this room type, 1 = all, 2 = mentions only, 3 = none. */
  notify_mode?: number;
  /** Text rooms only. Off by default for spaces; when on, messages are Megolm-encrypted
   * client-side and the server only ever stores ciphertext. */
  e2ee_enabled?: boolean;
  /** A text/voice channel follows its parent section's permission overrides (Discord category
   * sync) instead of its own. Resolved client-side in spacePermissions.channelOverridesSource. */
  permissions_synced?: boolean;
  /** Voice rooms only: connection cap (0 = unlimited) and audio bitrate in bits per
   * second (0 = the 64 kbps default). */
  user_limit?: number;
  bitrate?: number;
  /** Threads (type 6): Discord's thread metadata plus the counts and whether the viewer has
   * joined. Permissions come from the parent channel (`parent_id`). */
  thread?: ThreadInfo;
  /** Per-room permission overrides, carried on the room like Discord's
   * `permission_overwrites` on a channel. Always present on READY / GET /spaces/:id/rooms
   * (empty arrays when there are none) and kept current by SPACE_ROOM_*OVERRIDE_* events,
   * so opening a channel never has to fetch them. */
  permission_overrides?: SpaceRoomOverride[];
  user_overrides?: SpaceRoomUserOverride[];
  /** The room's global identity when its space spans instances (see rooms.federation);
   * what the E2EE engine keys the channel's Megolm sessions by. */
  federation?: { origin_domain: string; origin_id: string };
  created_at: string;
  updated_at?: string;
}

export function getSpaceRooms(spaceId: string) {
  return api<SpaceRoom[]>(`/spaces/${spaceId}/rooms`);
}

export function createSpaceRoom(
  spaceId: string,
  body: { name: string; type: number; parent_id?: string; e2ee_enabled?: boolean; user_limit?: number; bitrate?: number }
) {
  return api<SpaceRoom>(`/spaces/${spaceId}/rooms`, { method: 'POST', json: body });
}

export function reorderSpaceRooms(
  spaceId: string,
  body: {
    scope: 'sections' | 'channels';
    parent_section_id?: string | null;
    room_ids: string[];
  }
) {
  return api<void>(`/spaces/${spaceId}/rooms/reorder`, { method: 'POST', json: body });
}

export function moveSpaceChannel(
  spaceId: string,
  body: {
    channel_id: string;
    parent_section_id?: string | null;
    before_room_id?: string | null;
  }
) {
  return api<void>(`/spaces/${spaceId}/rooms/move`, { method: 'POST', json: body });
}

/** Member in a space – mirrors RoomParticipant with optional metadata. */
export interface SpaceMember extends RoomParticipant {
  joined_at?: string;
  roles?: string[];
}

export interface SpaceRole {
  id: string;
  name: string;
  permissions: number;
  position: number;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  /** Set when a bot install created the role (the bot's user id): it can be edited but
   * not deleted or given to anyone else, and it leaves with the bot. */
  bot_id?: string;
  created_at: string;
  updated_at: string;
}

/** A thread's state as the server keeps it (see api/threads.ts). */
export interface ThreadInfo {
  archived: boolean;
  archived_at?: string;
  locked: boolean;
  private: boolean;
  invitable: boolean;
  auto_archive_minutes: number;
  owner_id: string;
  starter_message_id?: string;
  last_active_at?: string;
  message_count: number;
  member_count: number;
  /** Whether the viewer is a member (gets notified, sees it nested in the sidebar). */
  joined: boolean;
}

export interface SpaceRoomOverride {
  role_id: string;
  allow: number;
  deny: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceRoomUserOverride {
  user_id: string;
  allow: number;
  deny: number;
  created_at: string;
  updated_at: string;
}

/** Compact public profile embedded in moderation payloads (invites, bans, audit log). */
export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  bot?: boolean;
}

export interface SpaceInvite {
  code: string;
  space_id: string;
  inviter_id: string;
  inviter?: UserSummary;
  /** 0 = unlimited */
  max_uses: number;
  current_uses: number;
  /** Absent = never expires */
  expires_at?: string;
  created_at: string;
}

export interface CreateInviteInput {
  /** 0 = never expires (max 30 days) */
  max_age_seconds?: number;
  /** 0 = unlimited (max 1000) */
  max_uses?: number;
}

export function listSpaceInvites(spaceId: string) {
  return api<SpaceInvite[]>(`/spaces/${spaceId}/invites`);
}

export function deleteSpaceInvite(spaceId: string, code: string) {
  return api<void>(`/spaces/${spaceId}/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
}

export type AuditActionType =
  | 'space_update'
  | 'room_create'
  | 'room_update'
  | 'room_delete'
  | 'role_create'
  | 'role_update'
  | 'role_delete'
  | 'member_kick'
  | 'member_ban_add'
  | 'member_ban_remove'
  | 'member_roles_update'
  | 'bot_add'
  | 'invite_create'
  | 'invite_delete'
  | 'emoji_create'
  | 'emoji_update'
  | 'emoji_delete'
  | 'override_update'
  | 'override_delete'
  | 'member_voice_mute'
  | 'member_voice_deafen'
  | 'member_voice_move'
  | 'member_voice_disconnect';

export const AUDIT_ACTION_TYPES: AuditActionType[] = [
  'space_update',
  'room_create',
  'room_update',
  'room_delete',
  'role_create',
  'role_update',
  'role_delete',
  'member_kick',
  'member_ban_add',
  'member_ban_remove',
  'member_roles_update',
  'bot_add',
  'invite_create',
  'invite_delete',
  'emoji_create',
  'emoji_update',
  'emoji_delete',
  'override_update',
  'override_delete',
  'member_voice_mute',
  'member_voice_deafen',
  'member_voice_move',
  'member_voice_disconnect',
];

export interface AuditLogEntry {
  id: string;
  action_type: AuditActionType | string;
  /** Actor */
  user_id: string;
  /** Depends on the action: user id, role id, room id, invite code, emoji id, "room:role:id" */
  target_id: string;
  changes?: Record<string, { old?: unknown; new?: unknown }>;
  reason?: string;
  created_at: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  users: Record<string, UserSummary>;
}

export function listSpaceAuditLog(spaceId: string, opts: { before?: string; limit?: number; action?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.before) q.set('before', opts.before);
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.action) q.set('action', opts.action);
  const qs = q.toString();
  return api<AuditLogPage>(`/spaces/${spaceId}/audit-log${qs ? `?${qs}` : ''}`);
}

/** Public widget document (no auth). Rejects when the widget is disabled. */
export interface SpaceWidget {
  id: string;
  name: string;
  icon: string;
  description: string;
  member_count: number;
  presence_count: number;
  instant_invite: string | null;
  invite_room_name?: string;
}

export function spaceWidgetUrl(spaceId: string): string {
  return `${getApiUrl()}/spaces/${spaceId}/widget.json`;
}

export function getSpaceWidget(spaceId: string): Promise<SpaceWidget> {
  return fetch(spaceWidgetUrl(spaceId)).then((res) => {
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
    return res.json() as Promise<SpaceWidget>;
  });
}

export function listSpaceMembers(spaceId: string) {
  return api<SpaceMember[]>(`/spaces/${spaceId}/members`);
}

/** Remove a member; they can rejoin with a new invite. Requires Kick Members (or owner). */
export function kickSpaceMember(spaceId: string, userId: string) {
  return api<void>(`/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' });
}

export interface SpaceBan {
  user_id: string;
  user?: UserSummary;
  reason?: string;
  banned_by: string;
  banned_by_user?: UserSummary;
  created_at: string;
}

/** Remove a member and block them from rejoining until unbanned. Requires Ban Members (or owner). */
export function banSpaceMember(spaceId: string, userId: string, reason?: string) {
  return api<void>(`/spaces/${spaceId}/bans/${userId}`, {
    method: 'POST',
    ...(reason ? { json: { reason } } : {}),
  });
}

export function unbanSpaceMember(spaceId: string, userId: string) {
  return api<void>(`/spaces/${spaceId}/bans/${userId}`, { method: 'DELETE' });
}

export function listSpaceBans(spaceId: string) {
  return api<SpaceBan[]>(`/spaces/${spaceId}/bans`);
}

/** Leave a space. The owner must transfer ownership or delete the space instead. */
export function leaveSpace(spaceId: string) {
  return api<void>(`/spaces/${spaceId}/leave`, { method: 'POST' });
}

/**
 * Hand the space to another member. Owner only - an Administrator can neither give the
 * space away nor take it. The previous owner stays a member.
 */
export function transferSpaceOwnership(spaceId: string, userId: string) {
  return api<Space>(`/spaces/${spaceId}/transfer-ownership`, { method: 'POST', json: { user_id: userId } });
}

/**
 * Delete a space and everything in it. Owner only and irreversible; `name` must be the
 * space's own name, which the server checks too rather than trusting the dialog.
 */
export function deleteSpace(spaceId: string, name: string) {
  return api<void>(`/spaces/${spaceId}`, { method: 'DELETE', json: { name } });
}

/** Mark every text/voice room in the space read - Discord's per-server "Mark As Read". */
export function ackAllSpaceRooms(spaceId: string) {
  return api<void>(`/spaces/${spaceId}/ack-all`, { method: 'POST' });
}

export function createSpaceInvite(spaceId: string, opts?: CreateInviteInput) {
  return api<SpaceInvite>(`/spaces/${spaceId}/invites`, { method: 'POST', ...(opts ? { json: opts } : {}) });
}

/** Public invite preview (no auth). */
export interface InvitePreview {
  space: Space;
  inviter?: { display_name: string };
  member_count?: number;
}

/**
 * An invite code as people share it: the code alone for a space on this instance, or
 * `code@domain` for one hosted elsewhere (joining goes through that instance). Codes are
 * passed to the API percent-encoded because of the "@".
 */
export function parseInviteCode(raw: string): { code: string; domain: string } | null {
  const s = raw.trim();
  const at = s.lastIndexOf('@');
  const code = at >= 0 ? s.slice(0, at) : s;
  const domain = at >= 0 ? s.slice(at + 1).toLowerCase() : '';
  if (!/^[A-Za-z0-9]{1,64}$/.test(code)) return null;
  if (at >= 0 && !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(domain)) return null;
  return { code, domain };
}

/** The invite code inside an invite URL from any Strafe instance, or the raw code typed as-is. */
export function inviteCodeFromInput(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/\/invite\/([^/?#\s]+)\/?(?:[?#].*)?$/);
  const candidate = m ? decodeURIComponent(m[1]) : s;
  return parseInviteCode(candidate) ? candidate : null;
}

export function getInvitePreview(code: string): Promise<InvitePreview> {
  return fetch(`${getApiUrl()}/spaces/invites/${encodeURIComponent(code)}`)
    .then((res) => {
      if (!res.ok) {
        return res.json().then((body: { error?: string }) => {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        });
      }
      return res.json() as Promise<InvitePreview>;
    });
}

export function joinSpaceByInvite(code: string) {
  return api<Space>(`/spaces/invites/${encodeURIComponent(code)}/join`, { method: 'POST' });
}

function getSessionToken(): string | null {
  return localStorage.getItem('session_token');
}

/** Multipart upload; Nebula URL is returned on the space as `icon`. Requires Manage space (or owner). */
export async function uploadSpaceIcon(spaceId: string, file: File): Promise<Space> {
  const form = new FormData();
  form.append('file', file);
  const token = getSessionToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/spaces/${spaceId}/icon`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<Space>;
}

/** Multipart upload; Nebula URL is returned on the space as `banner`. Requires Manage space (or owner). */
export async function uploadSpaceBanner(spaceId: string, file: File): Promise<Space> {
  const form = new FormData();
  form.append('file', file);
  const token = getSessionToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/spaces/${spaceId}/banner`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<Space>;
}

export function listSpaceRoles(spaceId: string) {
  return api<SpaceRole[]>(`/spaces/${spaceId}/roles`);
}

export function createSpaceRole(
  spaceId: string,
  body: { name: string; permissions: number; color?: number; hoist?: boolean; mentionable?: boolean }
) {
  return api<SpaceRole>(`/spaces/${spaceId}/roles`, { method: 'POST', json: body });
}

export function patchSpaceRole(
  spaceId: string,
  roleId: string,
  body: Partial<{
    name: string;
    permissions: number;
    position: number;
    color: number;
    hoist: boolean;
    mentionable: boolean;
  }>
) {
  return api<SpaceRole>(`/spaces/${spaceId}/roles/${roleId}`, { method: 'PATCH', json: body });
}

export function deleteSpaceRole(spaceId: string, roleId: string) {
  return api<void>(`/spaces/${spaceId}/roles/${roleId}`, { method: 'DELETE' });
}

export function setMemberSpaceRoles(spaceId: string, userId: string, roleIds: string[]) {
  return api<void>(`/spaces/${spaceId}/members/${userId}/roles`, {
    method: 'PUT',
    json: { role_ids: roleIds },
  });
}

export function listRoomPermissionOverrides(spaceId: string, roomId: string) {
  return api<SpaceRoomOverride[]>(`/spaces/${spaceId}/rooms/${roomId}/overrides`);
}

export function putRoomPermissionOverride(
  spaceId: string,
  roomId: string,
  roleId: string,
  body: { allow: number; deny: number }
) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}/overrides/${roleId}`, {
    method: 'PUT',
    json: body,
  });
}

export function deleteRoomPermissionOverride(spaceId: string, roomId: string, roleId: string) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}/overrides/${roleId}`, { method: 'DELETE' });
}

export function listRoomUserPermissionOverrides(spaceId: string, roomId: string) {
  return api<SpaceRoomUserOverride[]>(`/spaces/${spaceId}/rooms/${roomId}/overrides/users`);
}

export function putRoomUserPermissionOverride(
  spaceId: string,
  roomId: string,
  userId: string,
  body: { allow: number; deny: number }
) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}/overrides/users/${userId}`, {
    method: 'PUT',
    json: body,
  });
}

export function deleteRoomUserPermissionOverride(spaceId: string, roomId: string, userId: string) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}/overrides/users/${userId}`, { method: 'DELETE' });
}

/** Partial update: only the fields present are written. */
export function patchSpaceRoom(
  spaceId: string,
  roomId: string,
  body: { name?: string; topic?: string; slowmode_seconds?: number; e2ee_enabled?: boolean; user_limit?: number; bitrate?: number; permissions_synced?: boolean }
) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}`, { method: 'PATCH', json: body });
}

export function deleteSpaceRoom(spaceId: string, roomId: string) {
  return api<void>(`/spaces/${spaceId}/rooms/${roomId}`, { method: 'DELETE' });
}
