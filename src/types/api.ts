/**
 * Shared API types – aligned with equinox REST responses
 */

export interface User {
  id: string;
  username: string;
  discriminator: number;
  display_name: string;
  avatar?: string;
  bots?: string[];
  relationships?: string[];
}

export interface Room {
  id: string;
  type: number; // 1=PM, 2=GroupPM, 3=SpaceText, etc.
  name?: string;
  topic?: string;
  recipients?: string[];
  last_message_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_device_id: string;
  ciphertext: string;
  reply_to_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Session {
  token: string;
  user: User;
  session_id: string;
  expires_at: string;
}
