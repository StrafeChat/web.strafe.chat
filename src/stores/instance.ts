import { createStore } from 'solid-js/store';
import { api } from '../api/client';
import { getInstanceCapabilities } from '../api/instance';
import { disconnectStargate, onStargateEvent } from '../services/stargate/client';
import { logout } from './auth';

/**
 * What this client knows about the instance it's connected to. Federation info decides
 * how E2EE identities are formed: with a domain, every local user is @<id>:<domain> and
 * remote users keep their own home domain; without one, the pre-federation synthetic
 * server name is used so existing installs keep decrypting.
 */
export interface InstanceState {
  loaded: boolean;
  version: string;
  federationEnabled: boolean;
  /** This instance's federation domain ('' when federation is off). */
  domain: string;
  /** Registration challenge, when the instance runs one. The site key is public by design.
   * `apiUrl` is set only for providers the browser contacts directly (Cap). */
  captcha: { enabled: boolean; provider: string; siteKey: string; apiUrl: string };
  /** Voice/video calling (a LiveKit server is configured). Off hides every call control. */
  voiceEnabled: boolean;
  /** Registration needs an invite code. The registration form asks for one when this is
   * set; the server still decides, and waives it for the very first account. */
  inviteOnly: boolean;
  /** Whether the instance can send email at all (forgot-password exists, addresses have a
   * verification state) and whether a new account must verify before it can sign in. */
  email: { enabled: boolean; verificationRequired: boolean };
  /** The signed-in account administers this instance. Asked of the server after every
   * connection; false until it answers, which is the safe way to be wrong. */
  instanceAdmin: boolean;
}

export const [instance, setInstance] = createStore<InstanceState>({
  loaded: false,
  version: '',
  federationEnabled: false,
  domain: '',
  captcha: { enabled: false, provider: '', siteKey: '', apiUrl: '' },
  voiceEnabled: false,
  inviteOnly: false,
  email: { enabled: false, verificationRequired: false },
  instanceAdmin: false,
});

interface IndexResponse {
  strafe?: { version?: string };
  federation?: { enabled?: boolean; domain?: string };
  features?: {
    captcha?: { enabled?: boolean; provider?: string; site_key?: string; api_url?: string };
    voice?: { enabled?: boolean };
    invite_only?: { enabled?: boolean };
    email?: { enabled?: boolean; verification_required?: boolean };
  };
}

let inflight: Promise<void> | null = null;

/** Fetch GET / once (idempotent; safe to call from several places). */
export function loadInstanceInfo(): Promise<void> {
  if (instance.loaded) return Promise.resolve();
  if (!inflight) {
    inflight = api<IndexResponse>('/')
      .then((res) => {
        const cap = res.features?.captcha;
        setInstance({
          loaded: true,
          version: res.strafe?.version ?? '',
          federationEnabled: res.federation?.enabled === true,
          domain: res.federation?.enabled ? (res.federation.domain ?? '') : '',
          captcha: {
            // Only treat it as on when the widget can actually be rendered: hosted
            // providers need a site key, Cap needs a site key *and* the URL the browser
            // solves against, ALTCHA gets its challenge from this server and has
            // neither. Otherwise the register page would block on a widget it can
            // never show.
            enabled:
              cap?.enabled === true &&
              (cap?.provider === 'altcha'
                ? true
                : cap?.provider === 'cap'
                  ? !!cap?.site_key && !!cap?.api_url
                  : !!cap?.site_key),
            provider: cap?.provider ?? '',
            siteKey: cap?.site_key ?? '',
            apiUrl: cap?.api_url ?? '',
          },
          voiceEnabled: res.features?.voice?.enabled === true,
          inviteOnly: res.features?.invite_only?.enabled === true,
          email: {
            enabled: res.features?.email?.enabled === true,
            verificationRequired: res.features?.email?.enabled === true && res.features?.email?.verification_required === true,
          },
        });
      })
      .catch((e) => {
        console.warn('[instance] could not load instance info', e);
        setInstance('loaded', true);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Format a user as name#0001[@domain], showing the domain only for remote users. */
export function formatHandle(u: { username?: string; discriminator?: number | string; home_domain?: string }): string {
  const disc = u.discriminator == null ? '' : `#${String(u.discriminator).padStart(4, '0')}`;
  const base = `${u.username ?? ''}${disc}`;
  if (u.home_domain && instance.domain && u.home_domain !== instance.domain) return `${base}@${u.home_domain}`;
  return base;
}

/** True when the user lives on another instance. */
export function isRemoteUser(u: { home_domain?: string } | undefined | null): boolean {
  return !!u?.home_domain && !!instance.domain && u.home_domain !== instance.domain;
}

// ---- the signed-in account's standing on this instance --------------------------------

/**
 * Whether the current account administers this instance. Decides whether the admin
 * dashboard link and the instance settings section exist at all; every action behind
 * them is checked again by the server.
 */
export function loadInstanceCapabilities(): Promise<void> {
  return getInstanceCapabilities()
    .then((res) => setInstance('instanceAdmin', res.instance_admin === true))
    .catch(() => setInstance('instanceAdmin', false));
}

/**
 * The gateway tells a session it has been revoked - the account was banned, or signed out
 * everywhere - just before the server closes the socket. Sign out here rather than
 * waiting for the next API call to 401, and land on the login page with a reason so the
 * person is not left staring at a reconnecting spinner. A hard navigation on purpose:
 * it also drops every bit of in-memory state that belonged to the session.
 */
export function initInstanceHandlers(): () => void {
  return onStargateEvent((event) => {
    if (event.t !== 'SESSION_REVOKED') return;
    const d = ((event.d as { d?: unknown })?.d ?? event.d) as { reason?: string } | undefined;
    logout();
    disconnectStargate();
    const why = d?.reason === 'banned' ? 'banned' : 'revoked';
    window.location.assign(`/login?reason=${why}`);
  });
}
