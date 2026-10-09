/**
 * Base API client – fetch wrapper with auth and base URL
 */

import { ApiError } from './ApiError';
import { apiUrl } from '../lib/runtimeConfig';

export { ApiError } from './ApiError';

function getToken(): string | null {
  return localStorage.getItem('session_token');
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, ...reqInit } = init ?? {};
  const headers: HeadersInit = {
    ...(reqInit.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  // Read per request, not once at load: in the desktop app the instance can change
  // (choosing one on the sign-in page, switching accounts) without a reload.
  const res = await fetch(`${apiUrl()}${path}`, {
    ...reqInit,
    headers,
    body: json !== undefined ? JSON.stringify(json) : reqInit.body,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string; code?: string } & Record<string, unknown>;
    const message = err.error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, err.error_description, err.code, err);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getApiUrl(): string {
  return apiUrl();
}
