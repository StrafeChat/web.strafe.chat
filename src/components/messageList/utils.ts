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

export function isSystemMessage(msg: DecryptedMessage): msg is DecryptedMessage & { system_type: string; system_payload: string } {
  return !!(msg as DecryptedMessage & { system_type?: string }).system_type;
}

function participantName(id: string, participants?: RoomParticipant[], currentUserId?: string): string {
  if (id === currentUserId) return auth.user?.display_name || auth.user?.username || 'You';
  const p = participants?.find((x) => x.id === id);
  return p?.display_name || p?.username || 'Someone';
}

export function formatSystemMessageText(
  msg: DecryptedMessage & { system_type: string; system_payload: string },
  participants?: RoomParticipant[],
  currentUserId?: string
): string {
  const payload = (() => {
    try {
      return JSON.parse(msg.system_payload || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const actorName = participantName(payload.actor_id ?? '', participants, currentUserId);
  switch (msg.system_type) {
    case 'member_added':
      return `${actorName} added ${participantName(payload.user_id ?? '', participants, currentUserId)} to the group`;
    case 'member_removed':
      return `${actorName} removed ${participantName(payload.user_id ?? '', participants, currentUserId)} from the group`;
    case 'member_left':
      return `${participantName(payload.user_id ?? '', participants, currentUserId)} left the group`;
    case 'room_renamed':
      return `${actorName} renamed the group to ${payload.new_name ?? '?'}`;
    default:
      return 'System message';
  }
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
