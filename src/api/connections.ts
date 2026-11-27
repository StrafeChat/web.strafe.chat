import { api } from './client';

/**
 * Connections: verified links from an account to an identity elsewhere (a domain, a fediverse
 * account, a Bluesky handle, a GitHub or Discord account), shown on the profile to whom the owner
 * chooses. equinox internal/modules/connections.
 */

export type ConnectionProvider = 'domain' | 'fediverse' | 'bluesky' | 'github' | 'discord';

export const CONNECTION_PROVIDERS: readonly ConnectionProvider[] = ['domain', 'fediverse', 'bluesky', 'github', 'discord'];

export function isConnectionProvider(v: unknown): v is ConnectionProvider {
  return typeof v === 'string' && (CONNECTION_PROVIDERS as readonly string[]).includes(v);
}

/** Who may see a connection. The levels nest: friends see friends' and wider, and so on. */
export type ConnectionVisibility = 'me' | 'friends' | 'spaces' | 'everyone';

export const CONNECTION_VISIBILITIES: readonly ConnectionVisibility[] = ['me', 'friends', 'spaces', 'everyone'];

/** What this instance offers. */
export interface ConnectionProviderInfo {
  id: ConnectionProvider;
  /** `proof`: publish something, then verify. `oauth`: sign in there. */
  kind: 'proof' | 'oauth';
  needs_identifier: boolean;
}

/** A connection as its owner sees it. */
export interface OwnConnection {
  /** The account's id there (a domain, an actor URL, a DID, a numeric id). */
  id: string;
  provider: ConnectionProvider;
  name: string;
  url: string | null;
  method: string;
  verified: boolean;
  visibility: ConnectionVisibility;
  position: number;
  verified_at: string;
  checked_at?: string;
  created_at: string;
}

/** A connection as anyone else sees it. */
export interface ShownConnection {
  provider: string;
  name: string;
  url?: string;
  verified: boolean;
  /** The instance that checked it: the account's home. */
  verified_by?: string;
}

export interface MyConnections {
  connections: OwnConnection[];
  settings: { public_page: boolean };
  /** The account's Strafe address (<web>/@<username>), or '' when the instance has no web URL. */
  address: string;
  providers: ConnectionProviderInfo[];
}

export interface ConnectionInstructions {
  dns_name?: string;
  dns_value?: string;
  https_url?: string;
  https_body?: string;
  address?: string;
}

export interface StartedConnection {
  challenge_id: string;
  provider: ConnectionProvider;
  identifier?: string;
  kind: 'proof' | 'oauth';
  instructions?: ConnectionInstructions;
  authorize_url?: string;
  expires_at: string;
}

export function getMyConnections() {
  return api<MyConnections>('/users/@me/connections');
}

export function startConnection(provider: ConnectionProvider, identifier?: string) {
  return api<StartedConnection>(`/users/@me/connections/${provider}`, {
    method: 'POST',
    json: identifier ? { identifier } : {},
  });
}

export function verifyConnection(provider: ConnectionProvider, challengeId: string) {
  return api<OwnConnection>(`/users/@me/connections/${provider}/verify`, {
    method: 'POST',
    json: { challenge_id: challengeId },
  });
}

function connectionPath(c: Pick<OwnConnection, 'provider' | 'id'>): string {
  return `/users/@me/connections/${c.provider}/${encodeURIComponent(c.id)}`;
}

export function updateConnection(c: Pick<OwnConnection, 'provider' | 'id'>, patch: { visibility?: ConnectionVisibility; position?: number }) {
  return api<OwnConnection>(connectionPath(c), { method: 'PATCH', json: patch });
}

export function recheckConnection(c: Pick<OwnConnection, 'provider' | 'id'>) {
  return api<OwnConnection>(`${connectionPath(c)}/recheck`, { method: 'POST' });
}

export function removeConnection(c: Pick<OwnConnection, 'provider' | 'id'>) {
  return api<void>(connectionPath(c), { method: 'DELETE' });
}

export function setPublicPage(on: boolean) {
  return api<{ public_page: boolean }>('/users/@me/connections/settings', { method: 'PATCH', json: { public_page: on } });
}

/** What the caller may see of someone's connections. */
export function getUserConnections(userId: string) {
  return api<{ connections: ShownConnection[] }>(`/users/${userId}/connections`);
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  connections: ShownConnection[];
}

/** The public page at <web>/@<username>; a 404 when its owner hasn't turned it on. */
export function getPublicProfile(username: string) {
  return api<PublicProfile>(`/public/users/${encodeURIComponent(username)}`);
}
