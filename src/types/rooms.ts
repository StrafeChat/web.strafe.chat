import { RoomType } from './roomTypes';

export interface Room {
  topic: string;
  id: string;
  name?: string;
  type: RoomType;
  recipients?: string[];
  owner_id?: string;
  last_message_id?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at?: string;
  space_id?: string;
  parent_id?: string;
  position?: number;
}

export type RoomWithRecipients = {
  id: string;
  name: string;
  topic: string;
  type: number;
  recipients: string[];
  owner_id: string;
  last_message_id: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string | null;
  recipients_data: any[];
  unread_count?: number;
  mention_count?: number;
  space_id?: string;
  parent_id?: string;
  position?: number;
  permission_overrides?: {
    member?: {
      granted: number;
      denied: number;
    };
    roles?: {
      [roleId: string]: {
        granted: number;
        denied: number;
      };
    };
  };
};

export { RoomType };
