import { api } from './client';
import type { UserPresence } from '../api/relationships';

export interface RoomParticipant {
  id: string;
  username: string;
  discriminator?: number;
  display_name: string;
  avatar?: string;
  presence?: UserPresence;
}

export interface Room {
  id: string;
  type: number;
  recipients: string[];
  participants?: RoomParticipant[];
  space_id?: string;
  parent_id?: string;
  name?: string;
  topic?: string;
  position?: number;
  last_message_id?: string;
  last_read_message_id?: string;
  mention_count?: number;
  created_at: string;
  updated_at?: string;
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

/** Create a group PM. Returns the new room. */
export function createGroupPM(params: { name: string; recipient_ids: string[] }) {
  return api<Room>('/rooms', {
    method: 'POST',
    json: { name: params.name.trim(), recipient_ids: params.recipient_ids },
  });
}

/** Add a user to a group PM. */
export function addRoomParticipant(roomId: string, userId: string) {
  return api<void>(`/rooms/${roomId}/participants`, {
    method: 'POST',
    json: { user_id: userId },
  });
}

/** Trigger typing indicator. Rate-limited by backend (~5s). Returns 204. */
export function sendTyping(roomId: string) {
  return api<void>(`/rooms/${roomId}/typing`, { method: 'POST' });
}

/** Mark messages as read up to messageId. Returns 204. */
export function ackRoom(roomId: string, messageId: string) {
  return api<void>(`/rooms/${roomId}/ack`, { method: 'POST', json: { message_id: messageId } });
}

/** Fire-and-forget ack with keepalive for page unload (refresh/close). Request survives page teardown. */
export function ackRoomKeepalive(roomId: string, messageId: string) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;
  const url = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000') + `/rooms/${roomId}/ack`;
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message_id: messageId }),
    keepalive: true,
  }).catch(() => {});
}
