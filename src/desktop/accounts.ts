/**
 * The accounts the desktop app can switch between - on this instance or any other.
 *
 * The web client has one session: the token in localStorage, for the instance that served
 * the page. The desktop app keeps a list, one entry per (instance, user), in a file on the
 * Rust side (owner-only, next to the app's config), and "switching" is writing that entry's
 * token and instance into the places the web client already reads them from, then
 * reloading. A reload rather than an in-place swap on purpose: every store, the gateway
 * socket, the E2EE engine and the voice session belong to one account, and a fresh page
 * is the one way to be sure none of them leaks into the next.
 *
 * Nothing here runs in a browser (see boot.ts); the signals just stay empty.
 */

import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { auth } from '../stores/auth';
import { getDesktopInstance, setDesktopInstance, type DesktopInstance } from './instanceOverride';

export interface DesktopAccount {
  /** `${instance.domain}:${userId}` - the same person on two instances is two accounts. */
  id: string;
  instance: DesktopInstance;
  token: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  addedAt: number;
  lastUsedAt: number;
}

interface AccountsFile {
  version: 1;
  active: string | null;
  accounts: DesktopAccount[];
}

const SESSION_KEY = 'session_token';

const [accounts, setAccounts] = createSignal<DesktopAccount[]>([]);
const [activeId, setActiveId] = createSignal<string | null>(null);
const [loaded, setLoaded] = createSignal(false);

export { accounts as desktopAccounts, activeId as activeDesktopAccountId, loaded as desktopAccountsLoaded };

/** Active first, then most recently used. */
export function sortedDesktopAccounts(): DesktopAccount[] {
  const active = activeId();
  return [...accounts()].sort((a, b) => {
    if (a.id === active) return -1;
    if (b.id === active) return 1;
    return b.lastUsedAt - a.lastUsedAt;
  });
}

export function activeDesktopAccount(): DesktopAccount | undefined {
  const id = activeId();
  return id ? accounts().find((a) => a.id === id) : undefined;
}

function isAccount(v: unknown): v is DesktopAccount {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const inst = o.instance as Record<string, unknown> | undefined;
  return (
    typeof o.id === 'string' &&
    typeof o.token === 'string' &&
    typeof o.userId === 'string' &&
    typeof o.username === 'string' &&
    !!inst &&
    typeof inst.domain === 'string' &&
    typeof inst.apiUrl === 'string' &&
    typeof inst.stargateUrl === 'string'
  );
}

let saving: Promise<void> = Promise.resolve();

/** Writes are serialised so two quick changes cannot land out of order. */
function persist(): Promise<void> {
  const file: AccountsFile = { version: 1, active: activeId(), accounts: accounts() };
  saving = saving
    .catch(() => undefined)
    .then(() => invoke<void>('desktop_accounts_save', { value: file }))
    .catch((e) => console.warn('[desktop] could not save accounts', e));
  return saving;
}

function accountId(inst: DesktopInstance, userId: string): string {
  return `${inst.domain}:${userId}`;
}

/** Record (or refresh) the signed-in user as an account on the instance in use. */
function upsertSignedIn(token: string): void {
  const u = auth.user;
  const inst = getDesktopInstance();
  if (!u || !inst) return;
  const id = accountId(inst, u.id);
  const now = Date.now();
  setAccounts((list) => {
    const existing = list.find((a) => a.id === id);
    const next: DesktopAccount = {
      id,
      instance: inst,
      token,
      userId: u.id,
      username: u.username,
      displayName: u.display_name || u.username,
      ...(u.avatar ? { avatar: u.avatar } : {}),
      addedAt: existing?.addedAt ?? now,
      lastUsedAt: now,
    };
    return existing ? list.map((a) => (a.id === id ? next : a)) : [...list, next];
  });
  setActiveId(id);
  void persist();
}

/**
 * Load the file and keep it in step with the session. Called once at start-up by the
 * desktop runtime; the effects it installs live for the page.
 */
export async function initDesktopAccounts(): Promise<void> {
  try {
    const raw = (await invoke<AccountsFile | null>('desktop_accounts_load')) ?? null;
    if (raw && Array.isArray(raw.accounts)) {
      setAccounts(raw.accounts.filter(isAccount));
      setActiveId(typeof raw.active === 'string' ? raw.active : null);
    }
  } catch (e) {
    console.warn('[desktop] could not load accounts', e);
  }
  setLoaded(true);

  createRoot(() => {
    // Signed in (fresh login, or the session restored at start-up and READY told us who
    // we are): the account for this instance is the active one, with a current token.
    createEffect(
      on(
        () => [auth.token, auth.user?.id] as const,
        ([token, uid]) => {
          if (token && uid) upsertSignedIn(token);
        },
      ),
    );
    // Name and avatar changes keep the switcher rows current.
    createEffect(
      on(
        () => [auth.user?.username, auth.user?.display_name, auth.user?.avatar] as const,
        ([username, displayName, avatar]) => {
          const id = activeId();
          if (!id || !username) return;
          setAccounts((list) =>
            list.map((a) =>
              a.id === id ? { ...a, username, displayName: displayName || username, ...(avatar ? { avatar } : { avatar: undefined }) } : a,
            ),
          );
          void persist();
        },
        { defer: true },
      ),
    );
    // Signed out on this page (the Sign out button, a revoked session): the account goes
    // with it. A page that starts without a token is not a sign-out - that is what "add
    // an account" looks like - hence the transition, not the state.
    createEffect(
      on(
        () => auth.token,
        (token, prev) => {
          if (prev && !token) {
            const id = activeId();
            if (id) void removeDesktopAccount(id);
          }
        },
        { defer: true },
      ),
    );
  });
}

/** Become that account: its token and instance into place, then a fresh page. */
export async function switchDesktopAccount(id: string): Promise<void> {
  const acc = accounts().find((a) => a.id === id);
  if (!acc) return;
  setDesktopInstance(acc.instance);
  try {
    window.localStorage.setItem(SESSION_KEY, acc.token);
  } catch {
    return;
  }
  setAccounts((list) => list.map((a) => (a.id === id ? { ...a, lastUsedAt: Date.now() } : a)));
  setActiveId(id);
  await persist();
  window.location.assign('/');
}

/**
 * Sign in to another account without losing this one: the current account stays in the
 * list (its token is in the file), the page goes to the sign-in form signed out. The
 * instance stays selected so adding a second account on the same instance is one step.
 */
export async function beginAddDesktopAccount(): Promise<void> {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    return;
  }
  setActiveId(null);
  await persist();
  window.location.assign('/login');
}

/** Forget an account on this device. Signing out of the active one goes through the
 * normal sign-out, which lands here through the effect above. */
export async function removeDesktopAccount(id: string): Promise<void> {
  setAccounts((list) => list.filter((a) => a.id !== id));
  if (activeId() === id) setActiveId(null);
  await persist();
}

/** The instance most recently signed in to, to prefill the instance field. */
export function lastDesktopInstance(): DesktopInstance | null {
  return getDesktopInstance() ?? sortedDesktopAccounts()[0]?.instance ?? null;
}
