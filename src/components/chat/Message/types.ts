import { InviteInfo } from "../../../types/api";
import { MessageAttachment, MessageType } from "../../../types/messageTypes";

export interface MessageProps {
  id?: string;
  content: string;
  author_id: string;
  created_at: string | undefined;
  edited_at?: string | null;
  nonce?: string;
  pending?: boolean;
  error?: string;
  isCompact?: boolean;
  message_references?: string[];
  room_id?: string;
  editingMessageId?: string | null;
  onReply?: (messageId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  type?: MessageType;
  system_type?: string;
  system_data?: object;
  attachments?: MessageAttachment[];
}

export type InviteState = {
  code: string;
  info?: InviteInfo;
  loading: boolean;
  error?: string;
};
