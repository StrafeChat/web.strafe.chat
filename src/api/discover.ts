import { api } from './client';

/**
 * Discover: the instance's directory of spaces and bots. A space's manager or a bot's
 * owner applies with a tagline and tags, an instance administrator approves or declines,
 * and approved listings are what the Discover page shows.
 */

export type DiscoverKind = 'space' | 'bot';
export type DiscoverStatus = 'pending' | 'approved' | 'denied';

export interface DiscoverListing {
  kind: DiscoverKind;
  id: string;
  status: DiscoverStatus;
  tagline: string;
  tags: string[];
  requested_by?: string;
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  /** The administrator's word to the applicant (why it was declined or removed). */
  note?: string;
}

export interface DiscoverUser {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  bot?: boolean;
}

export interface DiscoverSpaceCard {
  id: string;
  name: string;
  name_acronym: string;
  icon?: string;
  banner?: string;
  description?: string;
  member_count: number;
  online_count: number;
}

export interface DiscoverBotCard {
  application_id: string;
  name: string;
  description?: string;
  icon?: string;
  bot?: DiscoverUser;
}

export interface DiscoverEntry extends DiscoverListing {
  space?: DiscoverSpaceCard;
  bot?: DiscoverBotCard;
  /** Who applied; present in the review queue only. */
  requested_by_user?: DiscoverUser;
}

export interface ListingInput {
  tagline: string;
  tags: string[];
}

export const DISCOVER_TAGLINE_MAX = 140;
export const DISCOVER_TAGS_MAX = 5;

const withQuery = (path: string, q: string) => (q.trim() ? `${path}?q=${encodeURIComponent(q.trim())}` : path);

export function listDiscoverSpaces(q = '') {
  return api<DiscoverEntry[]>(withQuery('/discover/spaces', q));
}

export function listDiscoverBots(q = '') {
  return api<DiscoverEntry[]>(withQuery('/discover/bots', q));
}

/** Join a listed space without an invite. */
export function joinDiscoverSpace(spaceId: string) {
  return api<{ id: string; name: string }>(`/discover/spaces/${encodeURIComponent(spaceId)}/join`, { method: 'POST' });
}

// ---- the applicant's side (Manage Space, or the application's owner) ----

export function getSpaceListing(spaceId: string) {
  return api<{ listing: DiscoverListing | null }>(`/spaces/${encodeURIComponent(spaceId)}/discover`).then((r) => r.listing);
}

export function applySpaceListing(spaceId: string, input: ListingInput) {
  return api<DiscoverListing>(`/spaces/${encodeURIComponent(spaceId)}/discover`, { method: 'PUT', json: input });
}

export function withdrawSpaceListing(spaceId: string) {
  return api<void>(`/spaces/${encodeURIComponent(spaceId)}/discover`, { method: 'DELETE' });
}

export function getBotListing(appId: string) {
  return api<{ listing: DiscoverListing | null }>(`/applications/${encodeURIComponent(appId)}/discover`).then((r) => r.listing);
}

export function applyBotListing(appId: string, input: ListingInput) {
  return api<DiscoverListing>(`/applications/${encodeURIComponent(appId)}/discover`, { method: 'PUT', json: input });
}

export function withdrawBotListing(appId: string) {
  return api<void>(`/applications/${encodeURIComponent(appId)}/discover`, { method: 'DELETE' });
}

// ---- instance administrators ----

export function listDiscoverQueue(status: DiscoverStatus) {
  return api<DiscoverEntry[]>(`/instance/discover?status=${status}`);
}

export function reviewDiscoverListing(kind: DiscoverKind, id: string, decision: 'approve' | 'deny', note = '') {
  return api<DiscoverListing>(`/instance/discover/${kind}/${encodeURIComponent(id)}/review`, { method: 'POST', json: { decision, note } });
}

/** Split a comma-separated tag line the way the server stores it. */
export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ').toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}
