import { MessageType, SystemMessageType } from './messageTypes';

export interface Message {
  id: string;
  room_id: string;
  author_id: string;
  content: string;
  attachments?: string[];
  embeds?: any[];
  mentions?: string[];
  mention_everyone?: boolean;
  message_refrences: string[];
  nonce?: string;
  created_at: string;
  updated_at?: string;
  sending?: boolean;
  type?: MessageType;
  system_type?: SystemMessageType;
  system_data?: {
    user_id?: string;
    actor_id?: string;
    old_value?: string;
    new_value?: string;
    extra_data?: any;
  };
}

export interface MessageCreateEvent {
  type: "MESSAGE_CREATE";
  message: Message;
}