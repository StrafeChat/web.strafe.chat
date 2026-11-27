import { api, getApiUrl } from './client';
import type { RoomParticipant } from './rooms';

/**
 * Room webhooks (Discord-compatible incoming webhooks). Someone with Manage Webhooks in a room
 * makes one; anything holding its secret URL can post into that room. The token comes back
 * only from create and from a token reset - never from a list or a get - so the UI shows it
 * once and offers "Reset URL" afterwards, never "show URL".
 *
 * Webhooks live only in plaintext space rooms (text, and a voice room's text); the server
 * refuses them in an end-to-end encrypted room (`room_encrypted`) and disables them when a
 * room turns encryption on (`disabled_reason: "encrypted"`).
 */

/** 1 = incoming (Discord's), 4 = bridge (masquerade, not managed here yet). 2 and 3 are
 * Discord's channel-follower and application types, never built. */
export const WEBHOOK_TYPE_INCOMING = 1;
export const WEBHOOK_TYPE_BRIDGE = 4;

export interface Webhook {
  id: string;
  type: number;
  space_id: string;
  room_id: string;
  name: string;
  /** Absolute URL of the webhook's own avatar, or null for the default one. */
  avatar?: string | null;
  /** Set when a bot created it: that bot may manage it without Manage Webhooks. */
  application_id?: string | null;
  /** Who made it. Absent on token-authenticated reads. */
  creator?: RoomParticipant | null;
  /** May this webhook ping @everyone, @here and roles at all. Only someone with Mention
   * Everyone in the room may turn it on. */
  mass_mentions?: boolean;
  /** `encrypted` while the room is end-to-end encrypted, else null. */
  disabled_reason?: string | null;
  created_at: string;
  last_used_at?: string | null;
  /** Only in the replies to create and token reset. */
  token?: string;
  url?: string;
}

/** A webhook as create / token reset return it: with its secret. */
export interface WebhookWithToken extends Webhook {
  token: string;
  url: string;
}

export interface CreateWebhookInput {
  name: string;
  /** A `data:image/png|jpeg|gif|webp;base64,...` URI. */
  avatar?: string;
  mass_mentions?: boolean;
  reason?: string;
}

export interface PatchWebhookInput {
  name?: string;
  /** A data URI to replace it, null to go back to the default avatar. */
  avatar?: string | null;
  mass_mentions?: boolean;
  /** Move it to another plaintext room of the same space. */
  room_id?: string;
  reason?: string;
}

/** The execute URL, from the server's answer or (an instance that leaves `url` out) built
 * from this instance's API root. */
function withUrl(w: Webhook & { token: string }): WebhookWithToken {
  const url = w.url || `${getApiUrl()}/webhooks/${encodeURIComponent(w.id)}/${encodeURIComponent(w.token)}`;
  return { ...w, url };
}

/** The room's webhooks (Manage Webhooks in the room). Never carries tokens. */
export function listRoomWebhooks(roomId: string) {
  return api<Webhook[]>(`/rooms/${encodeURIComponent(roomId)}/webhooks`);
}

/** Every webhook in the space's rooms where the caller has Manage Webhooks. */
export function listSpaceWebhooks(spaceId: string) {
  return api<Webhook[]>(`/spaces/${encodeURIComponent(spaceId)}/webhooks`);
}

export async function createRoomWebhook(roomId: string, input: CreateWebhookInput): Promise<WebhookWithToken> {
  const w = await api<Webhook & { token: string }>(`/rooms/${encodeURIComponent(roomId)}/webhooks`, {
    method: 'POST',
    json: input,
  });
  return withUrl(w);
}

export function getWebhook(id: string) {
  return api<Webhook>(`/webhooks/${encodeURIComponent(id)}`);
}

export function patchWebhook(id: string, input: PatchWebhookInput) {
  return api<Webhook>(`/webhooks/${encodeURIComponent(id)}`, { method: 'PATCH', json: input });
}

export function deleteWebhook(id: string, reason?: string) {
  return api<void>(`/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    ...(reason ? { json: { reason } } : {}),
  });
}

/** A new secret: the old URL stops working at once. Returns the webhook with the new URL. */
export async function resetWebhookToken(id: string): Promise<WebhookWithToken> {
  const w = await api<Webhook & { token: string }>(`/webhooks/${encodeURIComponent(id)}/token`, { method: 'POST' });
  return withUrl(w);
}

/** Biggest avatar the client will turn into a data URI (the server's avatar limit decides;
 * this only spares a pointless upload of something far too big). */
export const WEBHOOK_AVATAR_MAX_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** A picked image file as the data URI the webhook endpoints take, or an error key. */
export function webhookAvatarDataUri(file: File): Promise<{ uri: string } | { error: string }> {
  if (!AVATAR_TYPES.has(file.type)) return Promise.resolve({ error: 'settings.profile.imageTypeError' });
  if (file.size > WEBHOOK_AVATAR_MAX_BYTES) return Promise.resolve({ error: 'settings.profile.imageSizeError' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ uri: String(reader.result) });
    reader.onerror = () => resolve({ error: 'settings.profile.uploadFailed' });
    reader.readAsDataURL(file);
  });
}
