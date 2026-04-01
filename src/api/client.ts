/**
 * Base API client – fetch wrapper with auth and base URL
 */

import { ApiError } from './ApiError';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://192.168.1.115:4000';

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

  const res = await fetch(`${API_URL}${path}`, {
    ...reqInit,
    headers,
    body: json !== undefined ? JSON.stringify(json) : reqInit.body,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const message = err.error ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getApiUrl(): string {
  return API_URL;
}
