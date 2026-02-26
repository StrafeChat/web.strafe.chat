import { createStore } from 'solid-js/store';
import { listRelationships, type Relationship, type RelationshipUser } from '../api/relationships';
import { setUserPresence, type UserPresence } from './presence';
import { onStargateEvent } from '../services/stargate/client';

export const RelType = {
  None: 0,
  Friend: 1,
  Blocked: 2,
  IncomingRequest: 3,
  OutgoingRequest: 4,
  Implicit: 5,
  Suggestion: 6,
} as const;

export interface RelationshipsState {
  relationships: Relationship[];
  loading: boolean;
  hydrated: boolean;
}

export const [relationships, setRelationships] = createStore<RelationshipsState>({
  relationships: [],
  loading: false,
  hydrated: false,
});

export async function loadRelationships(): Promise<void> {
  setRelationships({ loading: true });
  try {
    const list = await listRelationships();
    for (const r of list) {
      if (r.user.presence?.status) {
        setUserPresence(r.user.id, r.user.presence);
      }
    }
    setRelationships({ relationships: dedupeByUserId(list), loading: false, hydrated: true });
  } catch {
    setRelationships({ loading: false, hydrated: true });
  }
}

export function clearRelationships() {
  setRelationships({ relationships: [], loading: false, hydrated: false });
}

/** Hydrate relationships from READY payload (avoids REST round-trip). */
export function hydrateRelationshipsFromReady(relsData: unknown[]): void {
  const list = dedupeByUserId(relsData as Relationship[]);
  for (const r of list) {
    if (r.user.presence?.status) {
      setUserPresence(r.user.id, r.user.presence);
    }
  }
  setRelationships({ relationships: list, loading: false, hydrated: true });
}

/** Update a user's presence from a PRESENCE_UPDATE WebSocket event. */
export function updatePresence(userId: string, p: UserPresence): void {
  setRelationships(
    'relationships',
    (rels: Relationship[]) =>
      rels.map((r) =>
        r.user.id === userId ? { ...r, user: { ...r.user, presence: p } } : r,
      ),
  );
}

export function friendDisplayName(rel: Relationship): string {
  return rel.user.display_name || rel.user.username || 'Unknown';
}

/** Normalize to string id (backend may send number in JSON). */
function normId(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

/** Normalize discriminator to 4-digit string. */
function disc(d: unknown): string {
  if (typeof d === 'number') return String(d).padStart(4, '0');
  if (typeof d === 'string') return d;
  return '0';
}

/** Build RelationshipUser from partial user payload (from RELATIONSHIP_ADD or RELATIONSHIP_REQUEST). */
function userFromPayload(u: unknown): RelationshipUser | null {
  if (!u || typeof u !== 'object') return null;
  const o = u as Record<string, unknown>;
  const id = normId(o.id);
  if (!id) return null;
  const username = typeof o.username === 'string' ? o.username : '';
  return {
    id,
    username,
    discriminator: disc(o.discriminator),
    display_name: (typeof o.display_name === 'string' ? o.display_name : '') || username,
    avatar: typeof o.avatar === 'string' ? o.avatar : undefined,
    presence: (o.presence as UserPresence) ?? undefined,
  };
}

/** Apply RELATIONSHIP_ADD: add or update relationship. Key by payload user.id (the other party), not payload id (backend sends recipient id). */
function applyRelationshipAdd(payload: unknown): void {
  const d = payload as Record<string, unknown>;
  const type = typeof d.type === 'number' ? d.type : 1;
  const user = userFromPayload(d.user);
  if (!user) return;
  const otherUserId = user.id;
  if (user.presence?.status) setUserPresence(otherUserId, user.presence);
  setRelationships('relationships', (rels: Relationship[]) => {
    const filtered = rels.filter((r) => (normId(r.user.id) ?? r.user.id) !== otherUserId);
    const next = [...filtered, { id: otherUserId, type, user, nickname: undefined, is_spam_request: undefined, stranger_request: undefined, user_ignored: undefined, since: undefined }];
    return dedupeByUserId(next);
  });
}

/** Ensure at most one relationship per user id (keeps last occurrence). */
function dedupeByUserId(rels: Relationship[]): Relationship[] {
  const byUserId = new Map<string, Relationship>();
  for (const r of rels) {
    const uid = normId(r.user.id) ?? r.user.id;
    byUserId.set(uid, r);
  }
  return [...byUserId.values()];
}

/** Apply RELATIONSHIP_REMOVE: remove relationship by other user id. Backend may send id as recipient; we also accept user_id from payload. */
function applyRelationshipRemove(payload: unknown): void {
  const d = payload as Record<string, unknown>;
  const id = normId(d.id) ?? normId((d as { user_id?: unknown }).user_id);
  if (!id) return;
  removeRelationshipLocally(id);
}

/** Remove a relationship from local state (e.g. after decline/cancel when server doesn't push to us). */
export function removeRelationshipLocally(userId: string): void {
  const uid = normId(userId) ?? userId;
  setRelationships('relationships', (rels: Relationship[]) => rels.filter((r) => (normId(r.user.id) ?? r.user.id) !== uid));
}

/** Apply RELATIONSHIP_REQUEST: add incoming request (from user sent us a request). */
function applyRelationshipRequest(payload: unknown): void {
  const d = payload as Record<string, unknown>;
  const from = d.from as Record<string, unknown> | undefined;
  const user = userFromPayload(from);
  if (!user) return;
  const otherUserId = user.id;
  const created = d.created_at;
  const since = typeof created === 'string' ? created : undefined;
  setRelationships('relationships', (rels: Relationship[]) => {
    const exists = rels.some((r) => (normId(r.user.id) ?? r.user.id) === otherUserId);
    if (exists) return rels;
    const next = [...rels, { id: otherUserId, type: RelType.IncomingRequest, user, nickname: undefined, is_spam_request: undefined, stranger_request: undefined, user_ignored: undefined, since }];
    return dedupeByUserId(next);
  });
}

/** Register Stargate handlers for RELATIONSHIP_ADD, RELATIONSHIP_REMOVE, RELATIONSHIP_REQUEST. Call once on app init. */
export function initRelationshipHandlers(): () => void {
  return onStargateEvent((event) => {
    const t = event.t;
    const payload = (event.d as { d?: unknown })?.d ?? event.d;
    if (t === 'RELATIONSHIP_ADD') {
      applyRelationshipAdd(payload);
      return;
    }
    if (t === 'RELATIONSHIP_REMOVE') {
      applyRelationshipRemove(payload);
      return;
    }
    if (t === 'RELATIONSHIP_REQUEST') {
      applyRelationshipRequest(payload);
      return;
    }
  });
}
