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

/**
 * Enum for different message types
 */
export enum MessageType {
  /** Regular user message */
  USER = 0,
  /** System-generated message */
  SYSTEM = 1
}

/**
 * Enum for different system message types
 */
export enum SystemMessageType {
  /** Member was added to the room */
  MEMBER_ADDED = "MEMBER_ADDED",
  /** Member was removed from the room */
  MEMBER_REMOVED = "MEMBER_REMOVED",
  /** Room name was changed */
  ROOM_NAME_CHANGED = "ROOM_NAME_CHANGED",
  /** Room topic was changed */
  ROOM_TOPIC_CHANGED = "ROOM_TOPIC_CHANGED",
  /** Room icon was changed */
  ROOM_ICON_CHANGED = "ROOM_ICON_CHANGED",
  /** Ownership was transferred */
  OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED"
}