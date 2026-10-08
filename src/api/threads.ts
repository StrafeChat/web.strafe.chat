import { api } from './client';
import type { RoomParticipant } from './rooms';

/**
 * Threads - Discord's model adapted to Strafe. A thread is a space room of type 6 inside a
 * text channel: started from a message (then it shares the message's id) or on its own,
 * public or private, with an explicit member list (you join by posting, being mentioned, or
 * on purpose), an archive state that times out on its own, and a lock. The server returns
 * threads in the same shape as any space room plus a `thread` block (see SpaceRoom.thread);
 * callers hand the raw record to upsertSpaceRoomFromPayload.
 */

export const ROOM_TYPE_THREAD = 6;

/** Discord's auto-archive choices, in minutes: an hour, a day, three days, a week. */
export const THREAD_AUTO_ARCHIVE_OPTIONS = [60, 1440, 4320, 10080] as const;
export const DEFAULT_THREAD_AUTO_ARCHIVE = 1440;
export const MAX_THREAD_NAME_LENGTH = 100;

export interface CreateThreadInput {
  name: string;
  auto_archive_minutes?: number;
  /** Standalone threads only: members-only thread (needs Create Private Threads). */
  private?: boolean;
  /** Private threads: whether members may add others (default true). */
  invitable?: boolean;
}

export interface UpdateThreadInput {
  name?: string;
  archived?: boolean;
  locked?: boolean;
  invitable?: boolean;
  auto_archive_minutes?: number;
  slowmode_seconds?: number;
}

export interface ThreadMember {
  user_id: string;
  joined_at: string;
  user?: Pick<RoomParticipant, 'id' | 'username' | 'display_name' | 'avatar' | 'bot' | 'public_flags'>;
}

type RawRoom = Record<string, unknown>;

/** Start a public thread from a message (the thread's id is the message's). */
export function createThreadFromMessage(roomId: string, messageId: string, input: CreateThreadInput) {
  return api<RawRoom>(`/rooms/${roomId}/messages/${messageId}/threads`, { method: 'POST', json: input });
}

/** Start a thread that is not attached to a message, public or private. */
export function createThread(roomId: string, input: CreateThreadInput) {
  return api<RawRoom>(`/rooms/${roomId}/threads`, { method: 'POST', json: input });
}

export function getThread(threadId: string) {
  return api<RawRoom>(`/rooms/${threadId}/thread`);
}

export function updateThread(threadId: string, input: UpdateThreadInput) {
  return api<RawRoom>(`/rooms/${threadId}/thread`, { method: 'PATCH', json: input });
}

export function deleteThread(threadId: string) {
  return api<void>(`/rooms/${threadId}/thread`, { method: 'DELETE' });
}

export function listThreadMembers(threadId: string) {
  return api<ThreadMember[]>(`/rooms/${threadId}/thread-members`);
}

export function joinThread(threadId: string) {
  return api<void>(`/rooms/${threadId}/thread-members/@me`, { method: 'PUT' });
}

export function leaveThread(threadId: string) {
  return api<void>(`/rooms/${threadId}/thread-members/@me`, { method: 'DELETE' });
}

export function addThreadMember(threadId: string, userId: string) {
  return api<void>(`/rooms/${threadId}/thread-members/${userId}`, { method: 'PUT' });
}

export function removeThreadMember(threadId: string, userId: string) {
  return api<void>(`/rooms/${threadId}/thread-members/${userId}`, { method: 'DELETE' });
}

/** Every active thread in the space the viewer can see. */
export function listActiveThreads(spaceId: string) {
  return api<{ threads: RawRoom[] }>(`/spaces/${spaceId}/threads/active`);
}

/** A channel's archived threads the viewer can see, most recently archived first. */
export function listArchivedThreads(roomId: string, opts: { before?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.before) q.set('before', opts.before);
  if (opts.limit) q.set('limit', String(opts.limit));
  const qs = q.toString();
  return api<{ threads: RawRoom[]; has_more: boolean }>(`/rooms/${roomId}/threads/archived${qs ? `?${qs}` : ''}`);
}
