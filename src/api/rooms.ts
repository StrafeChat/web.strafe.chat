import { api } from './client';
import { apiUrl } from '../lib/runtimeConfig';
import type { UserPresence } from '../api/relationships';

export interface RoomParticipant {
  id: string;
  username: string;
  discriminator?: number;
  display_name: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  about_me?: string;
  /** Free-text pronouns ("they/them"), shown under the name on profiles. */
  pronouns?: string;
  /** "MM-DD" - only sent for people who opted in to birthday announcements. No year. */
  birthday?: string;
  /** True when today (UTC) is this person's birthday. */
  is_birthday?: boolean;
  /** Profile-badge bitfield (see lib/badges.ts). */
  public_flags?: number;
  /** Bot account. */
  bot?: boolean;
  presence?: UserPresence;
  /** Federation: the user's home instance and the id it knows them by (present when the
   * instance federates; equals this instance/`id` for local users). */
  home_domain?: string;
  origin_id?: string;
}

/** A room's global identity across instances (set on rooms that span instances). */
export interface RoomFederation {
  origin_domain: string;
  origin_id: string;
}

export interface Room {
  id: string;
  type: number;
  recipients: string[];
  participants?: RoomParticipant[];
  federation?: RoomFederation;
  space_id?: string;
  parent_id?: string;
  name?: string;
  topic?: string;
  position?: number;
  creator_id?: string;
  /** When false, messages are stored as plaintext (group owner can change). Default true. */
  e2ee_enabled?: boolean;
  last_message_id?: string;
  last_read_message_id?: string;
  mention_count?: number;
  created_at: string;
  updated_at?: string;
  /** This user's own per-room notification settings - never visible to anyone else. */
  muted?: boolean;
  muted_until?: string;
  /** 0 = follow the global default for this room type, 1 = all, 2 = mentions only, 3 = none. */
  notify_mode?: number;
}

export function listRooms() {
  return api<Room[]>('/rooms');
}

export function getRoom(id: string) {
  return api<Room>(`/rooms/${id}`);
}

/** Get or create the user's notes room (self-PM). Returns the room. */
export function getNotesRoom() {
  return api<Room>('/rooms/notes');
}

export function createPM(recipientId: string) {
  return api<Room>('/rooms', { method: 'POST', json: { recipient_id: recipientId } });
}

/** Start (or open) a PM by handle - `name#0001` locally, `name#0001@other.instance` across federation. */
export function createPMByHandle(handle: string) {
  return api<Room>('/rooms', { method: 'POST', json: { recipient_handle: handle.trim() } });
}

/** Create a group PM. Returns the new room. Name is optional; if omitted, client shows member names. */
export function createGroupPM(params: { recipient_ids: string[]; name?: string }) {
  return api<Room>('/rooms', {
    method: 'POST',
    json: {
      recipient_ids: params.recipient_ids,
      ...(params.name != null && params.name !== '' && { name: params.name.trim() }),
    },
  });
}

/** Add a user to a group PM. */
export function addRoomParticipant(roomId: string, userId: string) {
  return api<void>(`/rooms/${roomId}/participants`, {
    method: 'POST',
    json: { user_id: userId },
  });
}

/** Remove a user from a group PM. Only the group creator can remove. */
export function removeRoomParticipant(roomId: string, userId: string) {
  return api<void>(`/rooms/${roomId}/participants/${userId}`, { method: 'DELETE' });
}

/** Update room (name and/or E2EE setting). Only the group creator. */
export function updateRoom(roomId: string, payload: { name?: string; e2ee_enabled?: boolean }) {
  const body: { name?: string; e2ee_enabled?: boolean } = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.e2ee_enabled !== undefined) body.e2ee_enabled = payload.e2ee_enabled;
  return api<Room>(`/rooms/${roomId}`, {
    method: 'PATCH',
    json: body,
  });
}

/** Update group name. Only the group creator. */
export function updateRoomName(roomId: string, name: string) {
  return updateRoom(roomId, { name: name.trim() });
}

/** Trigger typing indicator. Rate-limited by backend (~5s). Returns 204. */
export function sendTyping(roomId: string) {
  return api<void>(`/rooms/${roomId}/typing`, { method: 'POST' });
}

/** Mark messages as read up to messageId. Returns 204. */
export function ackRoom(roomId: string, messageId: string) {
  return api<void>(`/rooms/${roomId}/ack`, { method: 'POST', json: { last_read_message_id: messageId } });
}

export interface RoomNotifySettingsInput {
  muted?: boolean;
  /** ISO 8601 timestamp, or null to clear a timed mute. Omit to leave unchanged. */
  muted_until?: string | null;
  notify_mode?: number;
}

/** Updates the caller's own mute/notify-mode override for a room. Returns 204. */
export function setRoomNotifySettings(roomId: string, input: RoomNotifySettingsInput) {
  return api<void>(`/rooms/${roomId}/notify-settings`, { method: 'PATCH', json: input });
}

/** Fire-and-forget ack with keepalive for page unload (refresh/close). Request survives page teardown. */
export function ackRoomKeepalive(roomId: string, messageId: string) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
  const url = `${apiUrl()}/rooms/${roomId}/ack`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ last_read_message_id: messageId }),
    keepalive: true,
  }).catch(() => {});
}
