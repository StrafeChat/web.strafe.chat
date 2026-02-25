/**
 * Base API client – fetch wrapper with auth and base URL
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

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
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getApiUrl(): string {
  return API_URL;
}
