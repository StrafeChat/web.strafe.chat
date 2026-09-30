import { api, getApiUrl } from './client';
import { ApiError } from './ApiError';

/**
 * Developer platform: OAuth2 applications and their bots. An application's client_id is its
 * id; the client secret and bot token are returned once at creation/reset and never again.
 * A bot's user id is the application's id, so an install link needs no lookup.
 */
export interface BotProfile {
  id: string;
  username: string;
  discriminator: string;
  display_name: string;
  avatar: string;
  banner?: string;
  bio?: string;
  about_me?: string;
  accent_color?: string;
  public_flags?: number;
  bot: true;
}

export interface Application {
  id: string;
  client_id: string;
  owner_id: string;
  name: string;
  description: string;
  icon: string;
  redirect_uris: string[];
  has_bot: boolean;
  bot_user_id?: string;
  bot?: BotProfile;
  /** Whether anyone who manages a space may add the bot, or only the owner. */
  bot_public: boolean;
  created_at: string;
}

/** What anyone may see of an application (consent screen, a bot's profile). */
export interface PublicApplication {
  id: string;
  name: string;
  description: string;
  icon: string;
  has_bot: boolean;
  bot_public: boolean;
  bot?: BotProfile;
}

export interface CreatedApplication extends Application {
  /** Shown once. */
  client_secret: string;
}

export interface BotAccount extends BotProfile {
  /** Shown once. */
  token: string;
}

export function listApplications() {
  return api<Application[]>('/applications');
}
export function createApplication(name: string) {
  return api<CreatedApplication>('/applications', { method: 'POST', json: { name } });
}
export function getApplication(id: string) {
  return api<Application>(`/applications/${encodeURIComponent(id)}`);
}
/** Public profile of any application - resolves a bot user id (= client id) to its app. */
export function getPublicApplication(id: string) {
  return api<PublicApplication>(`/applications/${encodeURIComponent(id)}/public`);
}
export function updateApplication(
  id: string,
  patch: { name?: string; description?: string; redirect_uris?: string[]; bot_public?: boolean },
) {
  return api<Application>(`/applications/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch });
}
export function deleteApplication(id: string) {
  return api<void>(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export function resetApplicationSecret(id: string) {
  return api<{ client_secret: string }>(`/applications/${encodeURIComponent(id)}/secret`, { method: 'POST' });
}
export function addBot(id: string) {
  return api<BotAccount>(`/applications/${encodeURIComponent(id)}/bot`, { method: 'POST' });
}
export function resetBotToken(id: string) {
  return api<{ token: string }>(`/applications/${encodeURIComponent(id)}/bot/token`, { method: 'POST' });
}

// ---- the bot's profile (edited by the application's owner) -------------------------------

export interface BotProfilePatch {
  display_name?: string;
  bio?: string;
  about_me?: string;
  accent_color?: string;
}
export function updateBotProfile(id: string, patch: BotProfilePatch) {
  return api<BotProfile>(`/applications/${encodeURIComponent(id)}/bot`, { method: 'PATCH', json: patch });
}

async function uploadBotImage(id: string, kind: 'avatar' | 'banner', file: File): Promise<BotProfile> {
  const form = new FormData();
  form.append('file', file);
  const headers: HeadersInit = {};
  const token = localStorage.getItem('session_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/applications/${encodeURIComponent(id)}/bot/${kind}`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<BotProfile>;
}
/** Multipart avatar upload for the bot; the stored URL comes back on the profile. */
export function uploadBotAvatar(id: string, file: File) {
  return uploadBotImage(id, 'avatar', file);
}
/** Multipart banner upload for the bot. */
export function uploadBotBanner(id: string, file: File) {
  return uploadBotImage(id, 'banner', file);
}

// ---- OAuth2 (as an authorization server, for the consent screen) --------------------------

export type OAuthScope = 'identify' | 'email' | 'spaces' | 'spaces.join' | 'bot';

/** Every scope, in the order the URL generator and consent screen list them. */
export const OAUTH_SCOPES: OAuthScope[] = ['identify', 'email', 'spaces', 'spaces.join', 'bot'];

/** i18n key segment for a scope (`spaces.join` would otherwise nest in i18next). */
export function scopeKey(scope: string): string {
  return scope.replace(/\./g, '_');
}

/** A space the consenting user may add a bot to, with the bits they may grant there. */
export interface InstallTarget {
  id: string;
  name: string;
  name_acronym: string;
  icon: string;
  grantable_permissions: number;
}

export interface AuthorizeInfo {
  application: PublicApplication;
  scopes: OAuthScope[];
  /** Present when `bot` is among the scopes. */
  bot?: BotProfile;
  permissions?: number;
  spaces?: InstallTarget[];
}

export interface AuthorizeQuery {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  permissions?: string;
}

export function getAuthorizeInfo(q: AuthorizeQuery) {
  const params = new URLSearchParams({
    response_type: q.response_type,
    client_id: q.client_id,
    redirect_uri: q.redirect_uri,
    scope: q.scope,
  });
  if (q.permissions) params.set('permissions', q.permissions);
  return api<AuthorizeInfo>(`/oauth2/authorize/info?${params.toString()}`);
}

export interface AuthorizeResult {
  /** Where to send the browser (with ?code=&state=), or "" for a bare bot install. */
  location: string;
  space_id?: string;
  permissions?: number;
}

/** Records consent (installing the bot when asked) and returns the redirect location. */
export function authorize(q: AuthorizeQuery & { space_id?: string; permissions?: string }) {
  return api<AuthorizeResult>('/oauth2/authorize', { method: 'POST', json: q });
}

export interface OAuthGrant {
  application_id: string;
  /** Absent when the application has since been deleted. */
  application?: PublicApplication;
  scopes: OAuthScope[];
  created_at: string;
}
export function listGrants() {
  return api<OAuthGrant[]>('/oauth2/@me/grants');
}
export function revokeGrant(appId: string) {
  return api<void>(`/oauth2/@me/grants/${encodeURIComponent(appId)}`, { method: 'DELETE' });
}

/** The in-app consent page for an application, for install links and the URL generator. */
export function authorizeUrl(opts: {
  clientId: string;
  scopes: string[];
  redirectUri?: string;
  permissions?: number;
  spaceId?: string;
  state?: string;
}): string {
  const params = new URLSearchParams({ response_type: 'code', client_id: opts.clientId, scope: opts.scopes.join(' ') });
  if (opts.redirectUri) params.set('redirect_uri', opts.redirectUri);
  if (opts.permissions) params.set('permissions', String(opts.permissions));
  if (opts.spaceId) params.set('space_id', opts.spaceId);
  if (opts.state) params.set('state', opts.state);
  return `${window.location.origin}/oauth2/authorize?${params.toString()}`;
}
