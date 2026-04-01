/**
 * External link confirmation: show modal before opening external URLs.
 * Trusted domains skip the warning (stored in localStorage).
 */

import { createStore } from 'solid-js/store';

const TRUSTED_DOMAINS_KEY = 'externalLink_trustedDomains';

function loadTrustedDomains(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TRUSTED_DOMAINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

function saveTrustedDomains(domains: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRUSTED_DOMAINS_KEY, JSON.stringify(domains));
  } catch {
    // ignore
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return '';
  }
}

export function isTrustedDomain(url: string): boolean {
  const domain = getDomainFromUrl(url);
  return domain ? externalLink.trustedDomains.includes(domain) : false;
}

export interface ExternalLinkState {
  /** When set, show the confirmation modal for this URL */
  pendingUrl: string | null;
  trustedDomains: string[];
}

export const [externalLink, setExternalLink] = createStore<ExternalLinkState>({
  pendingUrl: null,
  trustedDomains: loadTrustedDomains(),
});

export function isExternalLink(href: string): boolean {
  try {
    return typeof window !== 'undefined' && new URL(href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Request opening an external URL. Call only for external links. If domain is trusted, opens immediately; else shows modal. */
export function requestOpenExternalLink(url: string): void {
  const domain = getDomainFromUrl(url);
  if (!domain) return;
  if (externalLink.trustedDomains.includes(domain)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  setExternalLink('pendingUrl', url);
}

/** Close modal without opening. */
export function closeExternalLinkModal(): void {
  setExternalLink('pendingUrl', null);
}

/** User confirmed: open link and optionally add domain to trusted list. */
export function confirmExternalLink(trustDomain: boolean): void {
  const url = externalLink.pendingUrl;
  if (!url) return;
  setExternalLink('pendingUrl', null);
  const domain = getDomainFromUrl(url);
  if (trustDomain && domain) {
    const next = [...externalLink.trustedDomains, domain];
    setExternalLink('trustedDomains', next);
    saveTrustedDomains(next);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
