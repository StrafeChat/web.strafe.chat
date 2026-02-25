/**
 * Stargate WebSocket protocol types
 * @see docs/STARGATE_CLIENT.md
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
} as const;

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

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
  user: { id: string; username: string; discriminator: number; display_name: string };
  session_id: string;
}

export interface EventPayload {
  t: string;
  space_id?: string;
  user_id?: string;
  d: unknown;
  from?: number;
}

export interface ErrorPayload {
  code: number;
  message: string;
}
