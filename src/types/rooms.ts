import { RoomType } from './roomTypes';

export interface Room {
  id: string;
  name?: string;
  type: RoomType;
  recipients?: string[];
  owner_id?: string;
  last_message_id?: string;
  icon?: string;
  created_at: string;
  updated_at?: string;
}

export interface RoomWithRecipients extends Room {
  recipients_data?: any[];
}