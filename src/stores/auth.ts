/**
 * Auth store – user, session, token
 * Token persisted in localStorage. User/rooms/relationships come from READY WS event when possible.
 */

import { createStore } from 'solid-js/store';
import { getMe, toAuthUser } from '../api/users';
import { setUserPresence } from './presence';
import { loadRooms, clearRooms, hydrateRoomsFromReady } from './rooms';
import { loadRelationships, clearRelationships, hydrateRelationshipsFromReady } from './relationships';

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

/** Hydrate auth + rooms + relationships from READY payload. Skips REST. */
export function hydrateFromReady(payload: {
  user?: { id: string; username: string; discriminator: number | string; display_name: string; presence?: { status: string; custom_status?: string } };
  session_id?: string;
  rooms?: unknown[];
  relationships?: unknown[];
}) {
  if (payload.user) {
    const d =
      typeof payload.user.discriminator === 'string'
        ? parseInt(payload.user.discriminator, 10)
        : payload.user.discriminator;
    const user = {
      id: payload.user.id,
      username: payload.user.username,
      discriminator: isNaN(d) ? 0 : d,
      display_name: payload.user.display_name,
    };
    setAuth('user', user);
    if (payload.user.presence?.status) {
      const p = payload.user.presence;
      if (['online', 'idle', 'dnd', 'offline'].includes(p.status)) {
        setUserPresence(user.id, {
          status: p.status as 'online' | 'idle' | 'dnd' | 'offline',
          custom_status: p.custom_status,
        });
      }
    }
  }
  if (payload.session_id) setAuth('sessionId', payload.session_id);
  if (Array.isArray(payload.rooms)) {
    hydrateRoomsFromReady(payload.rooms);
  }
  if (Array.isArray(payload.relationships)) {
    hydrateRelationshipsFromReady(payload.relationships);
  }
  setAuth({ loading: false, hydrated: true });
}

/** Restore session from localStorage. Data comes from READY when WS connects; fallback to REST. */
export async function hydrateAuth() {
  const token = localStorage.getItem('session_token');
  if (!token) {
    setAuth({ loading: false, hydrated: true });
    return;
  }
  setAuth('token', token);
  setAuth('loading', false);
  // User, rooms, relationships will be hydrated from READY in StargateProvider.
  // We set hydrated: false so RootLayout shows loading until READY arrives.
  // bootstrapFromRest() is the fallback if READY never comes.
}

/** Fallback when READY unavailable (WS failed, etc.). Fetches getMe + rooms + relationships. */
export async function bootstrapFromRest() {
  const token = auth.token;
  if (!token) {
    setAuth({ loading: false, hydrated: true });
    return;
  }
  try {
    const me = await getMe();
    if (me.presence && typeof me.presence === 'object' && 'status' in me.presence) {
      const p = me.presence as { status: string; custom_status?: string };
      if (['online', 'idle', 'dnd', 'offline'].includes(p.status)) {
        setUserPresence(me.id, {
          status: p.status as 'online' | 'idle' | 'dnd' | 'offline',
          custom_status: p.custom_status,
        });
      }
    }
    setAuth({ user: toAuthUser(me), loading: false, hydrated: true });
    await Promise.all([loadRooms(), loadRelationships()]);
  } catch {
    localStorage.removeItem('session_token');
    setAuth({ token: null, user: null, loading: false, hydrated: true });
  }
}
