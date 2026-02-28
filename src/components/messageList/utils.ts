import type { DecryptedMessage } from '../../stores/messages';
import { auth } from '../../stores/auth';
import type { RoomParticipant } from '../../api/rooms';

export const DECRYPT_ERROR_PLACEHOLDER = '[Unable to decrypt]';
export const LOADING_PLACEHOLDER = '...';

export function getMessageBodyText(msg: DecryptedMessage): string {
  if (msg.plaintext != null) return msg.plaintext;
  if (msg.decryptError) return DECRYPT_ERROR_PLACEHOLDER;
  return LOADING_PLACEHOLDER;
}

export function isEdited(msg: DecryptedMessage): boolean {
  if (!msg.updated_at || !msg.created_at) return false;
  return new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 1000;
}

export function getSenderDisplay(
  senderId: string,
  participants?: RoomParticipant[],
  currentUserId?: string
): { name: string; avatar?: string } {
  if (senderId === currentUserId) {
    return {
      name: auth.user?.display_name || auth.user?.username || 'You',
      avatar: undefined,
    };
  }
  const p = participants?.find((x) => x.id === senderId);
  return {
    name: p?.display_name || p?.username || 'Unknown',
    avatar: p?.avatar,
  };
}
