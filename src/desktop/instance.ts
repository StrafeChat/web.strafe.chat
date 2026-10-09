/**
 * Turning what someone typed ("strafe.chat", "chat.example.org", a dev API URL) into the
 * addresses the client needs. The instance says where it lives at
 * https://<domain>/.well-known/strafe; an instance that does not federate has no such
 * document, so the standard deployment layout (<domain>/api, <domain>/gateway) is tried
 * next, and a URL with a path is taken as the API itself (a developer's :4000).
 */

import { deriveStargateUrl } from '../lib/runtimeConfig';
import type { DesktopInstance } from './instanceOverride';

export interface ResolvedInstance extends DesktopInstance {
  /** Server software version, when the instance said. */
  version?: string;
}

export type InstanceResolveCode = 'invalid' | 'unreachable' | 'not_strafe';

export class InstanceResolveError extends Error {
  constructor(
    public readonly code: InstanceResolveCode,
    public readonly host: string,
  ) {
    super(`${code}: ${host}`);
    this.name = 'InstanceResolveError';
  }
}

const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)*(:[0-9]{1,5})?$/;
const FETCH_TIMEOUT_MS = 8000;

interface Normalized {
  host: string;
  /** Set when the input named the API directly (a URL with a path, or a port). */
  explicitApi?: string;
}

/** "https://Chat.Example.org/" -> chat.example.org; "http://127.0.0.1:4000" -> that API. */
export function normalizeInstanceInput(raw: string): Normalized {
  let s = raw.trim().replace(/^@/, '');
  if (!s) throw new InstanceResolveError('invalid', s);
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new InstanceResolveError('invalid', raw.trim());
  }
  const host = url.host.toLowerCase();
  if (!HOST_RE.test(host)) throw new InstanceResolveError('invalid', host);
  const path = url.pathname.replace(/\/+$/, '');
  const explicitScheme = /^[a-z]+:\/\//i.test(raw.trim());
  // A path means "this is the API" (https://x/api); so does a bare port with an explicit
  // scheme (http://127.0.0.1:4000) - nobody serves a well-known on a dev port.
  if (path || (explicitScheme && url.port)) {
    return { host, explicitApi: `${url.protocol}//${host}${path}` };
  }
  return { host };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const onOuter = () => ctrl.abort();
  signal?.addEventListener('abort', onOuter);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuter);
  }
}

/** GET <api>/ answers with the instance index; `strafe.version` is how we know it is one. */
async function probeApi(apiUrl: string, signal?: AbortSignal): Promise<string | null> {
  const body = (await fetchJson(`${apiUrl}/`, signal)) as { strafe?: { version?: string } } | null;
  if (!body || typeof body !== 'object' || !body.strafe) return null;
  return body.strafe.version ?? '';
}

interface WellKnown {
  domain?: string;
  api_url?: string;
  gateway_url?: string;
  software?: { name?: string; version?: string };
}

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

/** Loopback and dev-style names are reached over plain http when https fails. */
function mayBeInsecure(host: string): boolean {
  const h = host.replace(/:\d+$/, '');
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.test') ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) ||
    /:\d+$/.test(host)
  );
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Find an instance from what the person typed. Throws InstanceResolveError with a code the
 * form can translate; any other failure is reported as unreachable.
 */
export async function resolveInstance(raw: string, signal?: AbortSignal): Promise<ResolvedInstance> {
  const { host, explicitApi } = normalizeInstanceInput(raw);

  if (explicitApi) {
    const apiUrl = trimSlash(explicitApi);
    let version: string | null;
    try {
      version = await probeApi(apiUrl, signal);
    } catch {
      throw new InstanceResolveError('unreachable', host);
    }
    if (version === null) throw new InstanceResolveError('not_strafe', host);
    return { domain: host, apiUrl, stargateUrl: deriveStargateUrl(apiUrl), version };
  }

  const schemes = mayBeInsecure(host) ? ['https', 'http'] : ['https'];
  let reachedSomething = false;

  // 1. The instance's own statement of where it lives.
  for (const scheme of schemes) {
    let doc: WellKnown | null = null;
    try {
      doc = (await fetchJson(`${scheme}://${host}/.well-known/strafe`, signal)) as WellKnown;
      reachedSomething = true;
    } catch {
      continue;
    }
    if (doc && isHttpUrl(doc.api_url)) {
      const apiUrl = trimSlash(doc.api_url);
      const stargateUrl =
        typeof doc.gateway_url === 'string' && /^wss?:\/\//i.test(doc.gateway_url)
          ? trimSlash(doc.gateway_url)
          : deriveStargateUrl(apiUrl);
      return {
        domain: (doc.domain || host).toLowerCase(),
        apiUrl,
        stargateUrl,
        version: doc.software?.version,
      };
    }
  }

  // 2. The standard deployment layout, for an instance that does not federate.
  for (const scheme of schemes) {
    const apiUrl = `${scheme}://${host}/api`;
    try {
      const version = await probeApi(apiUrl, signal);
      reachedSomething = true;
      if (version !== null) return { domain: host, apiUrl, stargateUrl: deriveStargateUrl(apiUrl), version };
    } catch {
      /* next scheme */
    }
  }

  throw new InstanceResolveError(reachedSomething ? 'not_strafe' : 'unreachable', host);
}
