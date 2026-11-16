/**
 * The signed-in account's email address and any change waiting to be confirmed, for the
 * Security settings (web and mobile) and the /confirm-email page.
 *
 * Kept here rather than on AuthState.user on purpose: the address is not part of the
 * app-wide profile object, and is fetched only where it is shown (`GET /users/@me/email`).
 * It changes live through the self-only USER_EMAIL_UPDATE event (stores/userProfile.ts).
 */

import { createStore, reconcile } from 'solid-js/store';
import {
  cancelEmailChange,
  confirmEmailChange,
  getEmailState,
  getMe,
  requestEmailChange,
  resendEmailChange,
  type EmailChangeInput,
  type EmailState,
} from '../api/users';
import { isApiError } from '../api/ApiError';
import { auth, setAuthUser } from './auth';

export const [accountEmail, setAccountEmail] = createStore<{
  /** Whose state this is; reads while another account is signed in return null. */
  userId: string | null;
  state: EmailState | null;
  /** False when the instance has no GET /users/@me/email (an older server): the address
   * still shows, but it cannot be changed from here. */
  supported: boolean;
  loading: boolean;
}>({ userId: null, state: null, supported: true, loading: false });

/** The current account's email state, or null when it is not loaded (or belongs to an
 * account that is no longer the signed-in one). */
export function currentAccountEmail(): EmailState | null {
  const uid = auth.user?.id;
  if (!uid || accountEmail.userId !== uid) return null;
  return accountEmail.state;
}

/** Server data, read defensively: `pending` absent or malformed counts as none. */
function normalize(raw: EmailState): EmailState {
  const p = raw?.pending;
  return {
    email: typeof raw?.email === 'string' ? raw.email : '',
    verified_email: raw?.verified_email === true,
    pending:
      p && typeof p.email === 'string' && typeof p.expires_at === 'string'
        ? { email: p.email, expires_at: p.expires_at }
        : null,
  };
}

function syncAuthVerified(verified: boolean): void {
  if (auth.user && auth.user.verified_email !== verified) {
    setAuthUser({ ...auth.user, verified_email: verified });
  }
}

/** Store a whole state for `uid`. Wholesale (reconcile), because store setters merge and a
 * `pending: null` must really clear the old pending change. */
function store(uid: string | null, raw: EmailState, supported?: boolean): EmailState {
  const next = normalize(raw);
  // The account may have switched while the request was in flight: then this answer is
  // someone else's and must not be shown as the current account's.
  if (uid && uid === auth.user?.id) {
    setAccountEmail('userId', uid);
    setAccountEmail('state', reconcile(next));
    if (supported !== undefined) setAccountEmail('supported', supported);
    syncAuthVerified(next.verified_email);
  }
  return next;
}

/** Read the state (no side effects on the server). An instance without the route answers
 * 404/405; then the address comes from GET /users/@me and the Change button is hidden. */
export async function loadAccountEmail(): Promise<void> {
  const uid = auth.user?.id ?? null;
  if (!uid) return;
  setAccountEmail('loading', true);
  try {
    store(uid, await getEmailState(), true);
  } catch (err) {
    if (isApiError(err) && (err.status === 404 || err.status === 405)) {
      try {
        const me = await getMe();
        store(uid, { email: me.email ?? '', verified_email: me.verified_email === true, pending: null }, false);
      } catch {
        // Leave whatever was there.
      }
    }
    // Any other failure leaves the state unchanged.
  } finally {
    setAccountEmail('loading', false);
  }
}

/** Ask for the change. A non-null `pending` in the answer means a link went to the new
 * address; otherwise (an instance without email) it is already applied. */
export async function submitEmailChange(input: EmailChangeInput): Promise<EmailState> {
  const uid = auth.user?.id ?? null;
  return store(uid, await requestEmailChange(input), true);
}

export async function resendPendingEmailChange(): Promise<EmailState> {
  const uid = auth.user?.id ?? null;
  return store(uid, await resendEmailChange(), true);
}

export async function cancelPendingEmailChange(): Promise<EmailState> {
  const uid = auth.user?.id ?? null;
  return store(uid, await cancelEmailChange(), true);
}

export async function confirmPendingEmailChange(token: string): Promise<EmailState> {
  const uid = auth.user?.id ?? null;
  return store(uid, await confirmEmailChange(token), true);
}

/** USER_EMAIL_UPDATE `{email, verified_email}`: the address moved or was verified, from this
 * or another session (or by an administrator). Anything else is ignored. */
export function applyEmailUpdateEvent(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;
  if (typeof d.email !== 'string' || typeof d.verified_email !== 'boolean') return;
  const email = d.email;
  const verified = d.verified_email;
  const uid = auth.user?.id;
  if (uid && accountEmail.userId === uid && accountEmail.state) {
    const pending = accountEmail.state.pending;
    setAccountEmail('state', 'email', email);
    setAccountEmail('state', 'verified_email', verified);
    if (pending && pending.email.toLowerCase() === email.toLowerCase()) setAccountEmail('state', 'pending', null);
  }
  syncAuthVerified(verified);
}
