export interface Message {
  id: string;
  room_id: string;
  author_id: string;
  content: string;
  attachments?: string[];
  embeds?: any[];
  mentions?: string[];
  mention_everyone?: boolean;
  nonce?: string;
  created_at: string;
  updated_at?: string;
  sending?: boolean;
}

export interface MessageCreateEvent {
  type: "MESSAGE_CREATE";
  message: Message;
}