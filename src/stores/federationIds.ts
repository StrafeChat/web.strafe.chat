import { instance } from './instance';

/**
 * Local id → federated identity registry for the E2EE engine.
 *
 * The crypto engine keys everything by Matrix-shaped ids that must be the same on every
 * instance: users are @<origin_id>:<home_domain> (what the user's home instance calls
 * them), rooms are !<origin_room_id>:<origin_domain>. This client only ever handles this
 * instance's local ids (a remote user's shadow row, a mirrored room), so every place that
 * ingests users or rooms registers the mapping here and lib/e2ee/constants.ts consults it.
 */
const LEGACY_SERVER = 'strafe.internal';

interface UserIdentity {
  originId: string;
  domain: string;
}

const users = new Map<string, UserIdentity>();
const rooms = new Map<string, UserIdentity>();

/** The server part used for this instance's own users. */
export function localServer(): string {
  return instance.federationEnabled && instance.domain ? instance.domain : LEGACY_SERVER;
}

export function registerUserIdentity(u: { id?: string; home_domain?: string; origin_id?: string } | null | undefined): void {
  if (!u?.id) return;
  if (u.home_domain && u.origin_id) users.set(u.id, { originId: u.origin_id, domain: u.home_domain });
}

export function registerRoomIdentity(r: { id?: string; federation?: { origin_domain?: string; origin_id?: string } | null } | null | undefined): void {
  if (!r?.id) return;
  const f = r.federation;
  if (f?.origin_domain && f.origin_id) rooms.set(r.id, { originId: f.origin_id, domain: f.origin_domain });
}

/** @origin:domain for a local user id (falls back to this instance's own naming). */
export function userFederatedId(localUserId: string): string {
  const known = users.get(localUserId);
  if (known) return `@${known.originId}:${known.domain}`;
  return `@${localUserId}:${localServer()}`;
}

/** !origin:domain for a local room id (falls back to this instance's own naming). */
export function roomFederatedId(localRoomId: string): string {
  const known = rooms.get(localRoomId);
  if (known) return `!${known.originId}:${known.domain}`;
  return `!${localRoomId}:${localServer()}`;
}

/** Local room id for a federated room id, when this client has seen that room (else the raw id part). */
export function localRoomIdFor(fid: string): string {
  const m = /^!([^:]+):(.+)$/.exec(fid);
  if (!m) return fid;
  const [, originId, domain] = m;
  if (domain === localServer() || domain === LEGACY_SERVER) return originId!;
  for (const [localId, ident] of rooms) {
    if (ident.originId === originId && ident.domain === domain) return localId;
  }
  return originId!;
}

/** Local user id for a federated id, when this client has seen that user (else the raw id part). */
export function localUserIdFor(fid: string): string {
  const m = /^@([^:]+):(.+)$/.exec(fid);
  if (!m) return fid;
  const [, originId, domain] = m;
  if (domain === localServer() || domain === LEGACY_SERVER) return originId!;
  for (const [localId, ident] of users) {
    if (ident.originId === originId && ident.domain === domain) return localId;
  }
  return originId!;
}
