import type { Message, MessageMasquerade } from '../api/messages';

/**
 * Messages a webhook (or, from P2, a bridge) posted.
 *
 * Such a message has `webhook_id`, and its `sender_id` is the webhook id (for a bot-driven
 * bridge, the bot's user id) - never a person who could be messaged, befriended, given a
 * nickname or kicked. Who it shows as is `masquerade`, snapshotted per message: one webhook
 * posts under many names (Discord's per-message `username` / `avatar_url`), so neither its id
 * nor its embedded `author` (a compatibility copy with `bot: true`, for older clients) may go
 * into any cache keyed by user id - one webhook would take one name for every message.
 */

type WebhookishMessage = Pick<Message, 'webhook_id' | 'masquerade' | 'author' | 'sender_id'>;

export interface WebhookAuthor {
  /** The webhook (or bridge) that posted. */
  webhookId: string;
  kind: 'webhook' | 'bridge';
  name: string;
  /** Absolute URL, or undefined for the default avatar (picked from `webhookId`). */
  avatar?: string;
  /** A bridged person's stable id (P2). */
  puppetId?: string;
  /** Bridges only: what was bridged, and who really posted it. */
  bridge?: BridgedIdentity;
  /** Two messages with the same key show as the same author (and may group). */
  identityKey: string;
}

/** A bridged message's bridge, platform and real sender (the bot that drives the bridge). */
export interface BridgedIdentity {
  bridgeId: string;
  bridgeName?: string;
  /** `discord`, `matrix`, ... or `other` with `platformName`. */
  platform: string;
  platformName?: string;
  /** 0xRRGGBB, only when the bridge allows colours. */
  colour?: number;
  /** The person is a bot on the other platform. */
  externalBot?: boolean;
  /** Their profile on the platform, only when the bridge shows profile links. */
  profileUrl?: string;
  /** The real sender: the bot's user id and name, when the message names it. */
  via?: { id: string; name: string; username?: string; avatar?: string };
  /** A member here with the same name (the server's verdict when it was posted). */
  lookalike?: { id: string; username: string };
}

/** The masquerade as an object: tolerate a server that sends it as its stored JSON text. */
function masqueradeOf(msg: WebhookishMessage): MessageMasquerade | undefined {
  const m = msg.masquerade as unknown;
  if (m && typeof m === 'object') return m as MessageMasquerade;
  if (typeof m === 'string' && m.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(m) as Record<string, unknown>;
      // The stored form says `k`; the API form says `kind`.
      return { ...parsed, kind: String(parsed.kind ?? parsed.k ?? 'webhook') } as MessageMasquerade;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** True for a message a webhook or bridge posted. */
export function isWebhookMessage(msg: Partial<WebhookishMessage> | null | undefined): boolean {
  return !!msg?.webhook_id;
}

/** Who a webhook/bridge message shows as, or null for an ordinary message. `fallbackName` is
 * used when neither the masquerade nor the compatibility author names it. */
export function webhookAuthorOf(msg: WebhookishMessage | null | undefined, fallbackName = 'Webhook'): WebhookAuthor | null {
  if (!msg?.webhook_id) return null;
  const webhookId = String(msg.webhook_id);
  const m = masqueradeOf(msg);
  const kind: 'webhook' | 'bridge' = m?.kind === 'bridge' ? 'bridge' : 'webhook';
  const name = (m?.name || msg.author?.display_name || msg.author?.username || '').trim() || fallbackName;
  const avatar = (m?.avatar || (m ? undefined : msg.author?.avatar) || '').trim() || undefined;
  const puppetId = m?.bridge?.puppet_id ? String(m.bridge.puppet_id) : undefined;
  const identityKey =
    kind === 'bridge' && puppetId ? `b:${webhookId}:${puppetId}` : `w:${webhookId}:${name}\u0000${avatar ?? ''}`;
  const bridge = kind === 'bridge' ? bridgedIdentityOf(m, webhookId, msg.sender_id) : undefined;
  return { webhookId, kind, name, avatar, puppetId, identityKey, ...(bridge ? { bridge } : {}) };
}

/** The real sender a masquerade names in `via`: a bot's public user object (bot-driven
 * bridges), or `{ webhook: {...} }` (a webhook or a token bridge, which have no account). */
function viaOf(m: MessageMasquerade | undefined, senderId: string | undefined): BridgedIdentity['via'] {
  const v = m?.via as Record<string, unknown> | undefined;
  if (v && typeof v === 'object' && v.id != null && !v.webhook) {
    const name = String(v.display_name || v.username || '').trim();
    return {
      id: String(v.id),
      name: name || String(v.id),
      ...(typeof v.username === 'string' ? { username: v.username } : {}),
      ...(typeof v.avatar === 'string' && v.avatar ? { avatar: v.avatar } : {}),
    };
  }
  // A bot-driven bridge's message is sent by the bot: its sender id is the bot even when the
  // server left `via` out (the webhook id would mean a token bridge, which has no account).
  if (senderId && m?.bridge?.id && senderId !== String(m.bridge.id)) return { id: senderId, name: '' };
  return undefined;
}

function bridgedIdentityOf(m: MessageMasquerade | undefined, webhookId: string, senderId: string | undefined): BridgedIdentity {
  const b = m?.bridge;
  const colour = typeof m?.colour === 'number' && m.colour > 0 ? m.colour & 0xffffff : undefined;
  const via = viaOf(m, senderId);
  return {
    bridgeId: b?.id ? String(b.id) : webhookId,
    ...(b?.name ? { bridgeName: b.name } : {}),
    platform: (b?.platform || 'other').toLowerCase(),
    ...(b?.platform_name ? { platformName: b.platform_name } : {}),
    ...(colour !== undefined ? { colour } : {}),
    ...(b?.external_bot ? { externalBot: true } : {}),
    ...(typeof b?.profile_url === 'string' && /^https:\/\//i.test(b.profile_url) ? { profileUrl: b.profile_url } : {}),
    ...(via ? { via } : {}),
    ...(m?.lookalike?.id ? { lookalike: { id: String(m.lookalike.id), username: String(m.lookalike.username ?? '') } } : {}),
  };
}

/** True for a message a bridge posted as a bridged person (masquerade kind `bridge`). */
export function isBridgedMessage(msg: WebhookishMessage | null | undefined): boolean {
  return webhookAuthorOf(msg)?.kind === 'bridge';
}

/**
 * What decides whether two consecutive messages share one header. An ordinary message is its
 * sender; a webhook message is the sender, the webhook and the shown identity (name and avatar,
 * or the bridged person), so two names posted through one webhook never merge.
 */
export function messageAuthorKey(msg: WebhookishMessage): string {
  const w = webhookAuthorOf(msg);
  return w ? `${msg.sender_id}|${w.identityKey}` : `u:${msg.sender_id}`;
}
