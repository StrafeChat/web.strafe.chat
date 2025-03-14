/**
 * Interface for unread message data
 */
export interface MessageUnread {
  /** The ID of the user who has the unread message */
  user_id: string;
  /** The ID of the room containing the unread message */
  room_id: string;
  /** The ID of the unread message */
  message_id: string;
  /** When the message was marked as unread */
  created_at: string;
}

/**
 * Interface for message data
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** The content of the message */
  content?: string;
  /** The ID of the user who sent the message */
  author_id: string;
  /** The ID of the room where the message was sent */
  room_id: string;
  /** When the message was created */
  created_at: string;
  /** Client-side nonce for optimistic updates */
  nonce?: string;
  /** IDs of messages this message is referencing (replies) */
  message_references?: string[];
  /** Whether the message is unread */
  unread?: boolean;
}