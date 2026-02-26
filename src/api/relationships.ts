import { api } from './client';

export type RelationshipType =
  | 0  // none
  | 1  // friend
  | 2  // blocked
  | 3  // incoming request
  | 4  // outgoing request
  | 5  // implicit
  | 6; // suggestion

export interface UserPresence {
  status: 'online' | 'idle' | 'dnd' | 'offline';
  custom_status?: string;
}

export interface RelationshipUser {
  id: string;
  username: string;
  discriminator: string;
  display_name: string;
  avatar?: string;
  presence?: UserPresence;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  user: RelationshipUser;
  nickname?: string;
  is_spam_request?: boolean;
  stranger_request?: boolean;
  user_ignored?: boolean;
  since?: string;
}

export function listRelationships() {
  return api<Relationship[]>('/users/@me/relationships');
}

/** Send a friend request by username and discriminator (e.g. "1234"). */
export function sendFriendRequest(params: { username: string; discriminator: string }) {
  return api<void>('/users/@me/relationships', {
    method: 'POST',
    json: {
      username: params.username.trim(),
      discriminator: String(params.discriminator).trim(),
    },
  });
}

/** Send friend request by user id, or accept an incoming request (PUT accepts if they already sent). */
export function putRelationship(userId: string) {
  return api<void>(`/users/@me/relationships/${userId}`, { method: 'PUT' });
}

/** Remove relationship: unfriend, decline incoming, or cancel outgoing. */
export function removeRelationship(userId: string) {
  return api<void>(`/users/@me/relationships/${userId}`, { method: 'DELETE' });
}
