/**
 * Stargate WebSocket protocol types
 * @see docs/pages/05-gateway.md (the published gateway reference; docs/STARGATE_CLIENT.md is superseded)
 */

export const Op = {
  Heartbeat: 0,
  Subscribe: 1,
  Send: 2,
  Event: 3,
  Ready: 4,
  Unsubscribe: 5,
  Ping: 6,
  Pong: 7,
  Error: 8,
  /** Client -> server: what this connection reports the user is playing (null clears). */
  Activity: 9,
} as const;

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

/** op 1 / op 5. `space_id` names the CHANNEL: a space's own id or a room's id. */
export interface SubscribePayload {
  space_id?: string;
  user_id?: string;
}

export interface SendPayload {
  space_id: string;
  type: string;
  content: unknown;
  reply_to?: string;
}

export interface ReadyPayload {
  user: { id: string; username: string; display_name: string };
  session_id: string;
}

/** op 3's envelope. Unlike the subscribe frames, its ids mean what they say. */
export interface EventPayload {
  t: string;
  /** The space the event belongs to; absent for PM / group PM events and account events about no space. */
  space_id?: string;
  /** The room (channel, thread, PM) the event is about; absent for space-wide events. */
  room_id?: string;
  /** Only on events delivered on the account's own channel: names that account, never the actor. */
  user_id?: string;
  d: unknown;
}

export interface ErrorPayload {
  code: number;
  message: string;
}
