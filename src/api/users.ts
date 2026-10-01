import { api, getApiUrl } from './client';
import { ApiError } from './ApiError';
import type { User } from '../types/api';

export interface MeResponse {
  id: string;
  email: string;
  /** Whether a link sent to `email` was ever opened. Meaningful only on instances that can
   * send email (`instance.email.enabled`). */
  verified_email?: boolean;
  username: string;
  discriminator: string; // "0001" format
  display_name: string;
  bio?: string;
  about_me?: string;
  avatar?: string;
  banner?: string;
  accent_color?: string;
  public_flags?: number;
  bot?: boolean;
  presence?: unknown;
}

export function getMe() {
  return api<MeResponse>('/users/@me');
}

export interface PatchMeInput {
  display_name?: string;
  bio?: string;
  about_me?: string;
  avatar?: string;
  banner?: string;
  accent_color?: string;
  presence?: {
    status?: 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';
    custom_status?: string;
  };
}

/** Ask the server for a (new) verification link to the account's address. */
export function sendVerificationEmail() {
  return api<{ ok: true }>('/users/@me/email/verification', { method: 'POST' });
}

export function patchMe(input: PatchMeInput) {
  return api<MeResponse>('/users/@me', { method: 'PATCH', json: input });
}

export function toAuthUser(
  me: MeResponse,
): Pick<User, 'id' | 'username' | 'discriminator' | 'display_name'> & {
  avatar?: string;
  banner?: string;
  bio?: string;
  about_me?: string;
  public_flags?: number;
  bot?: boolean;
} {
  const d = parseInt(me.discriminator, 10);
  return {
    id: me.id,
    username: me.username,
    discriminator: isNaN(d) ? 0 : d,
    display_name: me.display_name,
    ...(me.avatar ? { avatar: me.avatar } : {}),
    ...(me.banner ? { banner: me.banner } : {}),
    ...(typeof me.bio === 'string' ? { bio: me.bio } : {}),
    ...(typeof me.about_me === 'string' ? { about_me: me.about_me } : {}),
    ...(typeof me.public_flags === 'number' ? { public_flags: me.public_flags } : {}),
    ...(me.bot ? { bot: true } : {}),
  };
}

/** Multipart avatar upload; Nebula URL is returned as avatar on the user object. */
export async function uploadAvatar(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/users/@me/avatar`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<MeResponse>;
}

/** Multipart banner upload; Nebula URL is returned as banner on the user object. */
export async function uploadBanner(file: File): Promise<MeResponse> {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/users/@me/banner`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(err.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<MeResponse>;
}

function getToken(): string | null {
  return localStorage.getItem('session_token');
}
