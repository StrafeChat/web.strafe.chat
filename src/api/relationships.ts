import { api } from './client';

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
  online?: boolean;
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
