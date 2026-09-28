import { createStore } from 'solid-js/store';
import { api } from '../api/client';

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
}

export const [instance, setInstance] = createStore<InstanceState>({
  loaded: false,
  version: '',
  federationEnabled: false,
  domain: '',
  captcha: { enabled: false, provider: '', siteKey: '', apiUrl: '' },
  voiceEnabled: false,
});

interface IndexResponse {
  strafe?: { version?: string };
  federation?: { enabled?: boolean; domain?: string };
  features?: {
    captcha?: { enabled?: boolean; provider?: string; site_key?: string; api_url?: string };
    voice?: { enabled?: boolean };
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
