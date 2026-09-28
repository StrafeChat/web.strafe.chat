import { api } from './client';

/**
 * Developer platform: OAuth2 applications and their bots. An application's client_id is its
 * id; the client secret and bot token are returned once at creation/reset and never again.
 */
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
  created_at: string;
}

export interface CreatedApplication extends Application {
  /** Shown once. */
  client_secret: string;
}

export interface BotAccount {
  id: string;
  username: string;
  discriminator: string;
  display_name: string;
  bot: true;
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
export function updateApplication(
  id: string,
  patch: { name?: string; description?: string; redirect_uris?: string[] },
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

// ---- OAuth2 (as an authorization server, for the consent screen) --------------------------

export type OAuthScope = 'identify' | 'email' | 'guilds';

export interface AuthorizeInfo {
  application: { id: string; name: string; description: string; icon: string; bot: boolean };
  scopes: OAuthScope[];
}

export interface AuthorizeQuery {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
}

export function getAuthorizeInfo(q: AuthorizeQuery) {
  const params = new URLSearchParams({
    response_type: q.response_type,
    client_id: q.client_id,
    redirect_uri: q.redirect_uri,
    scope: q.scope,
  });
  return api<AuthorizeInfo>(`/oauth2/authorize/info?${params.toString()}`);
}

/** Records consent and returns the location to send the browser to (with ?code=&state=). */
export function authorize(q: AuthorizeQuery) {
  return api<{ location: string }>('/oauth2/authorize', { method: 'POST', json: q });
}

export interface OAuthGrant {
  application_id: string;
  scopes: OAuthScope[];
  created_at: string;
}
export function listGrants() {
  return api<OAuthGrant[]>('/oauth2/@me/grants');
}
export function revokeGrant(appId: string) {
  return api<void>(`/oauth2/@me/grants/${encodeURIComponent(appId)}`, { method: 'DELETE' });
}
