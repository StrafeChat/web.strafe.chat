import { api } from './client';
import type { RoomParticipant } from './rooms';

export interface Space {
  id: string;
  name: string;
  name_acronym: string;
  description: string;
  icon: string;
  banner: string;
  owner_id: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  features: string[];
  afk_room_id?: string;
  afk_timeout: number;
  system_room_id?: string;
  system_room_flags: number;
  rules_room_id?: string;
  max_presences: number;
  max_members: number;
  vanity_url_code: string;
  preferred_locale: string;
  public_updates_room_id?: string;
  max_video_room_users: number;
  created_at: string;
  updated_at: string;
  everyone_role_id?: string;
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
  type: number; // 3 = text, 4 = voice, 5 = section
  name: string;
  topic?: string;
  position: number;
  space_id?: string;
  parent_id?: string;
  last_message_id?: string;
  created_at: string;
  updated_at?: string;
}

export function getSpaceRooms(spaceId: string) {
  return api<SpaceRoom[]>(`/spaces/${spaceId}/rooms`);
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
  created_at: string;
  updated_at: string;
}

export interface SpaceRoomOverride {
  role_id: string;
  allow: number;
  deny: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceInvite {
  code: string;
  space_id: string;
  inviter_id: string;
  created_at: string;
}

export function listSpaceMembers(spaceId: string) {
  return api<SpaceMember[]>(`/spaces/${spaceId}/members`);
}

export function createSpaceInvite(spaceId: string) {
  return api<SpaceInvite>(`/spaces/${spaceId}/invites`, { method: 'POST' });
}

/** Public invite preview (no auth). */
export interface InvitePreview {
  space: Space;
  inviter?: { display_name: string };
}

export function getInvitePreview(code: string): Promise<InvitePreview> {
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  return fetch(`${API_URL}/spaces/invites/${encodeURIComponent(code)}`)
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
  return api<Space>(`/spaces/invites/${code}/join`, { method: 'POST' });
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
