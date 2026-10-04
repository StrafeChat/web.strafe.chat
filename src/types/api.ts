/**
 * Shared API types – aligned with equinox REST responses
 */

export interface User {
  id: string;
  username: string;
  discriminator: number;
  display_name: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  /** Free-text pronouns ("they/them"), shown under the name on profiles. */
  pronouns?: string;
  /** "MM-DD", no year. Present for others only when they opted in. */
  birthday?: string;
  /** Whether the birthday is today, so clients need not compute it in their own timezone. */
  is_birthday?: boolean;
  /** Self-only: whether this person allows their birthday to be announced. */
  birthday_opt_in?: boolean;
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
