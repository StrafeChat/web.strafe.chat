/**
 * Auth store – user, session, token
 * Token persisted in localStorage. User/rooms/relationships come from READY WS event when possible.
 */

import { createStore } from 'solid-js/store';
import { getMe, toAuthUser } from '../api/users';
import { setUserPresence } from './presence';
import { loadRooms, clearRooms, hydrateRoomsFromReady } from './rooms';
import { loadRelationships, clearRelationships, hydrateRelationshipsFromReady } from './relationships';
import { loadSpaces, clearSpaces, hydrateSpacesFromReady, hydrateSpaceRoomsFromReady } from './spaces';
// Imported from the library rather than the store that drives it: stores/e2eeBackup reaches
// stores/messages, which reaches back here, and this file is the one everything depends on.
import { stopBackupSync } from '../lib/e2ee/keyBackup';
import { cancelRecoveryPrompt } from './recoveryPrompt';
import { clearVoice, hydrateVoiceFromReady } from './voice';

export interface AuthState {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    about_me?: string;
    /** Free-text pronouns ("they/them"), shown under the name on profiles. */
    pronouns?: string;
    /** "MM-DD", no year. Sent for the owner whether or not they opted in. */
    birthday?: string;
    birthday_opt_in?: boolean;
    public_flags?: number;
    bot?: boolean;
  } | null;
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
  clearSpaces();
  // The key-backup sweep would otherwise keep firing against a torn-down session, and a
  // recovery prompt left open belongs to the account that just signed out.
  stopBackupSync();
  cancelRecoveryPrompt();
  // Hang up: the LiveKit connection belongs to the session that just ended.
  clearVoice();
}

/** Hydrate auth + rooms + relationships + spaces + space_rooms from READY payload. Skips REST. */
export function hydrateFromReady(payload: {
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar?: string;
    banner?: string;
    bio?: string;
    about_me?: string;
    pronouns?: string;
    birthday?: string;
    birthday_opt_in?: boolean;
    public_flags?: number;
    bot?: boolean;
    presence?: { status: string; custom_status?: string };
  };
  session_id?: string;
  rooms?: unknown[];
  relationships?: unknown[];
  spaces?: unknown[];
  space_rooms?: Record<string, unknown[]>;
  voice_states?: unknown[];
  calls?: unknown[];
}) {
  if (payload.user) {
    const user = {
      id: payload.user.id,
      username: payload.user.username,
      display_name: payload.user.display_name,
      ...(typeof payload.user.avatar === 'string' ? { avatar: payload.user.avatar } : {}),
      ...(typeof payload.user.banner === 'string' ? { banner: payload.user.banner } : {}),
      ...(typeof payload.user.bio === 'string' ? { bio: payload.user.bio } : {}),
      ...(typeof payload.user.about_me === 'string' ? { about_me: payload.user.about_me } : {}),
      ...(typeof payload.user.pronouns === 'string' ? { pronouns: payload.user.pronouns } : {}),
      ...(typeof payload.user.birthday === 'string' ? { birthday: payload.user.birthday } : {}),
      ...(typeof payload.user.birthday_opt_in === 'boolean'
        ? { birthday_opt_in: payload.user.birthday_opt_in }
        : {}),
      ...(typeof payload.user.public_flags === 'number' ? { public_flags: payload.user.public_flags } : {}),
      ...(payload.user.bot ? { bot: true } : {}),
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
  if (Array.isArray(payload.spaces)) {
    hydrateSpacesFromReady(payload.spaces);
  } else {
    loadSpaces().catch(() => {});
  }
  if (payload.space_rooms && typeof payload.space_rooms === 'object' && !Array.isArray(payload.space_rooms)) {
    hydrateSpaceRoomsFromReady(payload.space_rooms as Record<string, unknown[]>);
  }
  // Absent when the instance has no voice: an empty picture is the right one then.
  hydrateVoiceFromReady(payload.voice_states ?? [], payload.calls ?? []);
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
    // getMe() and the room/relationship/space loads are independent REST calls (the
    // API client reads the token straight from localStorage) - run them concurrently
    // instead of waiting on getMe() first, to shave a full round trip off this fallback.
    const [me] = await Promise.all([getMe(), loadRooms(), loadRelationships(), loadSpaces()]);
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
  } catch {
    localStorage.removeItem('session_token');
    setAuth({ token: null, user: null, loading: false, hydrated: true });
  }
}
