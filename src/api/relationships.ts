import { api } from './client';
import type { UserPresence } from '../stores/presence';

export type { UserPresence };

export type RelationshipType =
  | 0  // none
  | 1  // friend
  | 2  // blocked
  | 3  // incoming request
  | 4  // outgoing request
  | 5  // implicit
  | 6; // suggestion

export interface RelationshipUser {
  id: string;
  username: string;
  discriminator: string;
  display_name: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  about_me?: string;
  presence?: UserPresence;
  /** Set for people on another instance; their handle is name#0001@home_domain. */
  home_domain?: string;
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

/** Send a friend request by handle: `name#0001` locally, `name#0001@their.instance` across
 * federation (their home instance shows them the request). */
export function sendFriendRequest(handle: string) {
  return api<void>('/users/@me/relationships', {
    method: 'POST',
    json: { handle: handle.trim() },
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

/** Block a user. Removes any friendship or pending request between you first. */
export function blockUser(userId: string) {
  return api<void>(`/users/@me/relationships/${userId}/block`, { method: 'PUT' });
}

/** Unblock a user. */
export function unblockUser(userId: string) {
  return api<void>(`/users/@me/relationships/${userId}/block`, { method: 'DELETE' });
}
