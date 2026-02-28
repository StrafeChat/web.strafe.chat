import { api } from './client';

export interface Message {
  room_id: string;
  id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CreateMessageInput {
  sender_device_id: number;
  ciphertext: string;
  reply_to_id?: number;
}

export function listMessages(roomId: string, params?: { before?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.before) search.set('before', params.before);
  if (params?.limit != null) search.set('limit', String(params.limit));
  const q = search.toString();
  return api<Message[]>(`/rooms/${roomId}/messages${q ? `?${q}` : ''}`);
}

export function getMessage(roomId: string, msgId: string) {
  return api<Message>(`/rooms/${roomId}/messages/${msgId}`);
}

export function createMessage(roomId: string, input: CreateMessageInput) {
  return api<Message>(`/rooms/${roomId}/messages`, {
    method: 'POST',
    json: input,
  });
}

export function editMessage(roomId: string, msgId: string, ciphertext: string) {
  return api<Message>(`/rooms/${roomId}/messages/${msgId}`, {
    method: 'PATCH',
    json: { ciphertext },
  });
}

export function deleteMessage(roomId: string, msgId: string) {
  return api<void>(`/rooms/${roomId}/messages/${msgId}`, { method: 'DELETE' });
}
