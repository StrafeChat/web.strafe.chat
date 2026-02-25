import { api } from './client';

export interface RoomParticipant {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
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
  created_at: string;
  updated_at?: string;
}

export function listRooms() {
  return api<Room[]>('/rooms');
}

export function getRoom(id: string) {
  return api<Room>(`/rooms/${id}`);
}

export function createPM(recipientId: string) {
  return api<Room>('/rooms', { method: 'POST', json: { recipient_id: recipientId } });
}
