/**
 * Auth store – user, session, token
 * Token persisted in localStorage; user fetched on hydrate or login.
 */

import { createStore } from 'solid-js/store';
import { getMe, toAuthUser } from '../api/users';
import { loadRooms, clearRooms } from './rooms';
import { loadRelationships, clearRelationships } from './relationships';

export interface AuthState {
  user: { id: string; username: string; discriminator: number; display_name: string } | null;
  token: string | null;
  sessionId: string | null;
  loading: boolean;
  hydrated: boolean;
}

export const [auth, setAuth] = createStore<AuthState>({
  user: null,
  token: null,
  sessionId: null,
  loading: true,
  hydrated: false,
});

export function setAuthUser(user: AuthState['user']) {
  setAuth('user', user);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('session_token', token);
  else localStorage.removeItem('session_token');
  setAuth('token', token);
}

export function logout() {
  setAuthToken(null);
  setAuth({ user: null, sessionId: null });
  clearRooms();
  clearRelationships();
}

/** Restore session from localStorage and validate with API. Call on app init. */
export async function hydrateAuth() {
  const token = localStorage.getItem('session_token');
  if (!token) {
    setAuth({ loading: false, hydrated: true });
    return;
  }
  setAuth('token', token);
  try {
    const me = await getMe();
    setAuth({ user: toAuthUser(me), loading: false, hydrated: true });
    // Load rooms and relationships in parallel (non-blocking)
    void Promise.all([loadRooms(), loadRelationships()]);
  } catch {
    localStorage.removeItem('session_token');
    setAuth({ token: null, user: null, loading: false, hydrated: true });
  }
}
