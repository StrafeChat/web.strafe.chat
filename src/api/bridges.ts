import { api } from './client';
import type { RoomParticipant } from './rooms';

/**
 * Bridges (spec section 5): a room integration declared for one external platform, through
 * which its driver - in this phase always a bot holding Masquerade in the room - posts as
 * "bridged users" (puppets): stable identities from that platform, always shown with the
 * platform's tag and the bot one click away. People see what their room is bridged with (the
 * header badge, the notice); managers (Manage Webhooks) change its settings, pause or delete
 * it; moderators (Kick Members or Manage Messages) block a bridged user from it.
 *
 * Creating a bridge is the bot's job (`room.createBridge` in strafe.js); token-driven bridges
 * for bridge software without a bot account come later, so the client never makes one.
 */

export const BRIDGE_PLATFORMS = ['discord', 'matrix', 'irc', 'telegram', 'slack', 'xmpp', 'revolt', 'other'] as const;
export type BridgePlatform = (typeof BRIDGE_PLATFORMS)[number];

export function isBridgePlatform(v: unknown): v is BridgePlatform {
  return typeof v === 'string' && (BRIDGE_PLATFORMS as readonly string[]).includes(v);
}

export type BridgeState = 'active' | 'paused' | 'disabled';
/** Why a bridge is not active: a manager paused it, the room became private (resumed with the
 * acknowledgement), the driving bot lost Masquerade or Send there (resumes by itself), or the
 * room is end-to-end encrypted. */
export type BridgeStateReason = 'paused_by_manager' | 'paused_by_driver' | 'became_private' | 'driver_lost_permission' | 'encrypted' | (string & {});

/** What the room is bridged with, as the driver declared it (the UI says it is self-declared). */
export interface BridgeRemote {
  name: string;
  url?: string | null;
}

export interface BridgeSettings {
  /** Copy messages of bots and webhooks here to the platform (off: Strife's default). */
  relay_bots: boolean;
  /** Copy messages other bridges posted here (off: a room bridged twice does not cross-feed). */
  relay_other_bridges: boolean;
  /** A bridged reply may ping the Strafe person it answers (the only ping a bridge can make). */
  reply_pings: boolean;
  /** Bridged users may carry a name colour. Turning it on needs Manage Roles. */
  allow_colour: boolean;
  /** Cards offer "Open profile on <platform>" (through the external-link dialog). */
  show_profile_links: boolean;
}

export const DEFAULT_BRIDGE_SETTINGS: BridgeSettings = {
  relay_bots: false,
  relay_other_bridges: false,
  reply_pings: true,
  allow_colour: false,
  show_profile_links: false,
};

/**
 * The public summary everyone who can view the room gets (GET /rooms/:id/bridges, READY's room
 * objects, BRIDGE_CREATE/UPDATE/DELETE): transparency - anyone may see what their room is
 * bridged with and by what.
 */
export interface BridgeSummary {
  id: string;
  platform: BridgePlatform | (string & {});
  /** Shown on the tag for `other` ("Mastodon"). */
  platform_name?: string | null;
  name: string;
  remote?: BridgeRemote | null;
  state: BridgeState | (string & {});
  state_reason?: BridgeStateReason | null;
  /** The driving bot's name. */
  driver_name?: string | null;
  /** The driving bot's user id (its application's client id), when the server sends it. */
  driver_id?: string | null;
  application_id?: string | null;
  room_id?: string;
  space_id?: string;
  created_at?: string;
}

/** The full object, for the room's managers and the driver (GET /bridges/:id). */
export interface Bridge extends BridgeSummary {
  type?: number;
  avatar?: string | null;
  driver?: 'bot' | 'token' | (string & {});
  creator?: RoomParticipant | null;
  settings: BridgeSettings;
}

/** A bridged person a moderator blocked from this bridge. Never carries the external user id. */
export interface BridgeBlock {
  puppet_id: string;
  name?: string;
  avatar?: string | null;
  reason?: string | null;
  blocked_at?: string;
  blocked_by?: RoomParticipant | string | null;
}

export interface PatchBridgeInput {
  name?: string;
  settings?: Partial<BridgeSettings>;
  state?: 'active' | 'paused';
  /** Resuming (or keeping) a bridge in a room not everyone can see needs this. */
  acknowledge_private?: boolean;
  reason?: string;
}

function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

/** Normalise a summary from any payload (ids may arrive as numbers from older shapes). */
export function bridgeSummaryFromPayload(raw: unknown): BridgeSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const id = str(d.id);
  if (!id) return null;
  const remote = d.remote && typeof d.remote === 'object' ? (d.remote as Record<string, unknown>) : null;
  return {
    id,
    platform: typeof d.platform === 'string' ? d.platform : 'other',
    platform_name: typeof d.platform_name === 'string' && d.platform_name ? d.platform_name : null,
    name: typeof d.name === 'string' ? d.name : '',
    remote: remote && typeof remote.name === 'string' ? { name: remote.name, url: typeof remote.url === 'string' ? remote.url : null } : null,
    state: typeof d.state === 'string' ? d.state : 'active',
    state_reason: typeof d.state_reason === 'string' && d.state_reason ? d.state_reason : null,
    driver_name: typeof d.driver_name === 'string' ? d.driver_name : null,
    driver_id: str(d.driver_id) ?? str(d.application_id) ?? null,
    application_id: str(d.application_id) ?? null,
    ...(d.room_id != null ? { room_id: String(d.room_id) } : {}),
    ...(d.space_id != null ? { space_id: String(d.space_id) } : {}),
    ...(typeof d.created_at === 'string' ? { created_at: d.created_at } : {}),
  };
}

function bridgeFromPayload(raw: unknown): Bridge {
  const base = bridgeSummaryFromPayload(raw) ?? { id: '', platform: 'other', name: '', state: 'active' };
  const d = (raw ?? {}) as Record<string, unknown>;
  const s = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Partial<BridgeSettings>;
  return {
    ...base,
    ...(typeof d.type === 'number' ? { type: d.type } : {}),
    avatar: typeof d.avatar === 'string' ? d.avatar : null,
    ...(typeof d.driver === 'string' ? { driver: d.driver } : {}),
    creator: (d.creator as RoomParticipant | null | undefined) ?? null,
    settings: { ...DEFAULT_BRIDGE_SETTINGS, ...s },
  };
}

/** What the room is bridged with: anyone who can view the room. */
export async function listRoomBridges(roomId: string): Promise<BridgeSummary[]> {
  const list = await api<unknown[]>(`/rooms/${encodeURIComponent(roomId)}/bridges`);
  return (Array.isArray(list) ? list : []).map(bridgeSummaryFromPayload).filter((b): b is BridgeSummary => !!b);
}

/** The full bridge: Manage Webhooks in its room, or the driver. */
export async function getBridge(id: string): Promise<Bridge> {
  return bridgeFromPayload(await api<unknown>(`/bridges/${encodeURIComponent(id)}`));
}

export async function patchBridge(id: string, input: PatchBridgeInput): Promise<Bridge> {
  return bridgeFromPayload(await api<unknown>(`/bridges/${encodeURIComponent(id)}`, { method: 'PATCH', json: input }));
}

/** Unbridge the room (the server posts the "unbridged" notice). */
export function deleteBridge(id: string, reason?: string) {
  return api<void>(`/bridges/${encodeURIComponent(id)}`, { method: 'DELETE', ...(reason ? { json: { reason } } : {}) });
}

/** Blocked bridged users, newest first (Kick Members or Manage Messages in the room). */
export async function listBridgeBlocks(id: string, opts: { before?: string } = {}): Promise<BridgeBlock[]> {
  const q = opts.before ? `?before=${encodeURIComponent(opts.before)}` : '';
  const list = await api<unknown>(`/bridges/${encodeURIComponent(id)}/blocks${q}`);
  const rows = Array.isArray(list) ? list : Array.isArray((list as { blocks?: unknown[] })?.blocks) ? (list as { blocks: unknown[] }).blocks : [];
  return rows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      puppet_id: String(r.puppet_id ?? r.id ?? ''),
      ...(typeof r.name === 'string' ? { name: r.name } : {}),
      avatar: typeof r.avatar === 'string' ? r.avatar : null,
      reason: typeof r.reason === 'string' ? r.reason : null,
      ...(typeof r.blocked_at === 'string' ? { blocked_at: r.blocked_at } : {}),
      blocked_by: (r.blocked_by as BridgeBlock['blocked_by']) ?? null,
    }))
    .filter((b) => b.puppet_id);
}

/** Refuse a bridged user's future sends, edits and reactions through this bridge. */
export function blockBridgedUser(bridgeId: string, puppetId: string, reason?: string) {
  return api<void>(`/bridges/${encodeURIComponent(bridgeId)}/blocks/${encodeURIComponent(puppetId)}`, {
    method: 'PUT',
    json: reason ? { reason } : {},
  });
}

export function unblockBridgedUser(bridgeId: string, puppetId: string) {
  return api<void>(`/bridges/${encodeURIComponent(bridgeId)}/blocks/${encodeURIComponent(puppetId)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------------------
// Consent (spec 5.9): may bridges copy my messages to other platforms?
// ---------------------------------------------------------------------------------------

/** The account default: `deny` turns every space's bridges off for you unless a space says
 * otherwise; `allow` (or unset) leaves it to each space's mode. */
export type AccountBridgeConsent = 'allow' | 'deny';
/** A per-space choice; `inherit` follows the account default and the space's mode. */
export type SpaceBridgeConsent = 'inherit' | 'allow' | 'deny';
/** A space's mode: everyone is copied unless they opt out (default), or only people who opt in. */
export type BridgeConsentMode = 'optout' | 'optin';

/** The account default (null: never set, which counts as "leave it to each space"). */
export async function getAccountBridgeConsent(): Promise<AccountBridgeConsent | null> {
  const r = await api<Record<string, unknown> | null>('/users/@me/bridge-consent');
  const v = r?.default ?? r?.bridge_consent;
  return v === 'allow' || v === 'deny' ? v : null;
}

export function setAccountBridgeConsent(value: AccountBridgeConsent) {
  return api<unknown>('/users/@me/bridge-consent', { method: 'PUT', json: { default: value } });
}

export interface MySpaceBridgeConsent {
  state: SpaceBridgeConsent;
  /** The space's mode, when the server says it here. */
  mode?: BridgeConsentMode;
}

/** Your own choice for one space (and the space's mode, when sent). */
export async function getMySpaceBridgeConsent(spaceId: string): Promise<MySpaceBridgeConsent> {
  const r = await api<Record<string, unknown> | null>(`/spaces/${encodeURIComponent(spaceId)}/members/@me/bridge-consent`);
  const s = r?.state;
  const mode = r?.mode ?? r?.bridge_consent_mode;
  return {
    state: s === 'allow' || s === 'deny' ? s : 'inherit',
    ...(mode === 'optin' || mode === 'optout' ? { mode } : {}),
  };
}

/** Switch a space between opt-out (everyone copied unless they say no) and opt-in. Manage Space. */
export function setSpaceBridgeConsentMode(spaceId: string, mode: BridgeConsentMode) {
  return api<unknown>(`/spaces/${encodeURIComponent(spaceId)}/bridge-consent`, { method: 'PUT', json: { mode } });
}

export function setMySpaceBridgeConsent(spaceId: string, state: SpaceBridgeConsent) {
  return api<unknown>(`/spaces/${encodeURIComponent(spaceId)}/members/@me/bridge-consent`, { method: 'PUT', json: { state } });
}

/**
 * Whether bridges copy this person's messages in a space (spec 5.9): the per-space override,
 * else the account default when it is off, else the space's mode. The server decides for real
 * (it filters the bridges' feed); this only tells the person what will happen.
 */
export function effectiveBridgeConsent(input: {
  space: SpaceBridgeConsent | undefined;
  account: AccountBridgeConsent | null | undefined;
  mode: BridgeConsentMode | null | undefined;
}): 'allow' | 'deny' {
  if (input.space === 'allow' || input.space === 'deny') return input.space;
  if (input.account === 'deny') return 'deny';
  return input.mode === 'optin' ? 'deny' : 'allow';
}
