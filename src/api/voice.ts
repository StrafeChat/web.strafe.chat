import { api } from './client';

/** Profile summary carried on every voice state so tiles render without a member fetch. */
export interface VoiceUserSummary {
  id: string;
  username: string;
  discriminator: number;
  display_name: string;
  avatar?: string;
  /** Set for someone on another instance (see stores/federationIds). */
  home_domain?: string;
  origin_id?: string;
}

/** One user's presence in one voice room (Discord's VoiceState). */
export interface VoiceState {
  user_id: string;
  room_id: string;
  space_id?: string;
  session_id: string;
  /** The LiveKit participant identity as issued: "<user id>.<session id>", or
   * "<federated id>.<session id>" in a room shared with another instance. */
  identity?: string;
  self_mute: boolean;
  self_deaf: boolean;
  /** Imposed by a moderator. */
  mute: boolean;
  deaf: boolean;
  self_video: boolean;
  self_stream: boolean;
  /** No Speak permission in this room. */
  suppress: boolean;
  priority_speaker: boolean;
  /** LiveKit has confirmed the connection. */
  connected: boolean;
  joined_at: string;
  user?: VoiceUserSummary;
}

/** A ringing or running call in a PM / group PM. */
export interface VoiceCall {
  room_id: string;
  started_by: string;
  started_at: string;
  /** Participants still being rung. */
  ringing: string[];
}

export interface VoiceJoinResult {
  url: string;
  token: string;
  room_name: string;
  state: VoiceState;
  states: VoiceState[];
  /** Audio bitrate to publish at, bits per second. */
  bitrate: number;
  call?: VoiceCall | null;
}

export function joinVoice(roomId: string, opts: { self_mute?: boolean; self_deaf?: boolean } = {}) {
  return api<VoiceJoinResult>(`/rooms/${roomId}/voice/join`, { method: 'POST', json: opts });
}

export function leaveVoice() {
  return api<void>('/voice/leave', { method: 'POST' });
}

export function patchVoiceState(patch: {
  self_mute?: boolean;
  self_deaf?: boolean;
  self_video?: boolean;
  self_stream?: boolean;
}) {
  return api<VoiceState>('/voice/state', { method: 'PATCH', json: patch });
}

export function listVoiceStates(roomId: string) {
  return api<{ states: VoiceState[]; call: VoiceCall | null }>(`/rooms/${roomId}/voice/states`);
}

/** Ring the named participants of a group call (everyone not yet in it when omitted). */
export function ringCall(roomId: string, userIds?: string[]) {
  return api<VoiceCall>(`/rooms/${roomId}/call/ring`, {
    method: 'POST',
    json: userIds?.length ? { user_ids: userIds } : {},
  });
}

export function declineCall(roomId: string) {
  return api<void>(`/rooms/${roomId}/call/decline`, { method: 'POST' });
}

/** Moderator actions on a member in one of the space's voice rooms. */
export function moderateVoice(spaceId: string, userId: string, patch: { mute?: boolean; deaf?: boolean; room_id?: string }) {
  return api<void>(`/spaces/${spaceId}/members/${userId}/voice`, { method: 'PATCH', json: patch });
}

export function disconnectVoiceMember(spaceId: string, userId: string) {
  return api<void>(`/spaces/${spaceId}/members/${userId}/voice`, { method: 'DELETE' });
}
