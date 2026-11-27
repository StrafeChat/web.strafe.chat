import { createStore, produce } from 'solid-js/store';
import {
  bridgeSummaryFromPayload,
  effectiveBridgeConsent,
  getAccountBridgeConsent,
  getBridge,
  getMySpaceBridgeConsent,
  listRoomBridges,
  type AccountBridgeConsent,
  type Bridge,
  type BridgeConsentMode,
  type BridgeSummary,
  type SpaceBridgeConsent,
} from '../api/bridges';
import { onStargateEvent } from '../services/stargate/client';
import { setSpaces, spaces } from './spaces';
import { auth, setAuth } from './auth';

/**
 * Bridges as the client knows them.
 *
 * - What a room is bridged with lives on the room itself (`SpaceRoom.bridges`, from READY and
 *   room payloads) and is kept current here from BRIDGE_CREATE / BRIDGE_UPDATE / BRIDGE_DELETE,
 *   so the header badge, the composer hint and the system notice never fetch anything.
 * - The full objects (settings, creator) are for the room's managers, loaded only by room
 *   settings > Integrations and refreshed on BRIDGE_UPDATE once loaded.
 * - Consent: the account default and the per-space choices of the signed-in person, plus each
 *   space's mode, for telling them whether their messages are copied. The server enforces it
 *   (it filters every bridge's feed); the client only explains it.
 */
interface BridgesState {
  /** Full bridge objects by id (managers only). */
  full: Record<string, Bridge | undefined>;
  /** undefined = not loaded yet; null = never set (leave it to each space). */
  account: AccountBridgeConsent | null | undefined;
  /** Per space: the person's own choice, and the space's mode when the server said it there. */
  bySpace: Record<string, { state: SpaceBridgeConsent; mode?: BridgeConsentMode } | undefined>;
}

const [bridges, setBridges] = createStore<BridgesState>({ full: {}, account: undefined, bySpace: {} });
export { bridges };

/** The space a room belongs to, among the room lists loaded. */
function spaceOfRoom(roomId: string): string | undefined {
  for (const [sid, list] of Object.entries(spaces.spaceRoomsBySpaceId)) {
    if (list?.some((r) => r.id === roomId)) return sid;
  }
  return undefined;
}

/** What a room is bridged with (public summaries), or an empty list. Reactive. */
export function roomBridges(spaceId: string | undefined, roomId: string | undefined): BridgeSummary[] {
  if (!roomId) return [];
  const sid = spaceId ?? spaceOfRoom(roomId);
  if (!sid) return [];
  return spaces.spaceRoomsBySpaceId[sid]?.find((r) => r.id === roomId)?.bridges ?? [];
}

/** The bridges of a room that are running (a paused or disabled one copies nothing). */
export function activeRoomBridges(spaceId: string | undefined, roomId: string | undefined): BridgeSummary[] {
  return roomBridges(spaceId, roomId).filter((b) => b.state === 'active');
}

/** Replace a room's list of bridge summaries in the spaces store. */
export function setRoomBridges(roomId: string, list: BridgeSummary[], spaceId?: string): void {
  const sid = spaceId ?? spaceOfRoom(roomId);
  if (!sid) return;
  setSpaces(
    'spaceRoomsBySpaceId',
    sid,
    produce((rooms) => {
      const room = rooms?.find((r) => r.id === roomId);
      if (room) room.bridges = list;
    })
  );
}

function upsertSummary(roomId: string, b: BridgeSummary, spaceId?: string): void {
  const current = roomBridges(spaceId, roomId);
  const idx = current.findIndex((x) => x.id === b.id);
  const next = idx >= 0 ? current.map((x, i) => (i === idx ? { ...x, ...b } : x)) : [...current, b];
  setRoomBridges(roomId, next, spaceId);
}

function removeSummary(bridgeId: string, roomId?: string): void {
  const rooms = roomId ? [roomId] : Object.values(spaces.spaceRoomsBySpaceId).flatMap((l) => (l ?? []).map((r) => r.id));
  for (const rid of rooms) {
    const current = roomBridges(undefined, rid);
    if (current.some((x) => x.id === bridgeId)) setRoomBridges(rid, current.filter((x) => x.id !== bridgeId));
  }
}

/** Load (or reload) a room's bridges from the server: for a server whose room payloads don't
 * carry them, and after a manager's change. */
export async function refreshRoomBridges(roomId: string, spaceId?: string): Promise<BridgeSummary[]> {
  const list = await listRoomBridges(roomId);
  setRoomBridges(roomId, list, spaceId);
  return list;
}

/** The full object of one bridge (managers). */
export async function loadBridge(id: string): Promise<Bridge> {
  const b = await getBridge(id);
  putBridge(b);
  return b;
}

/** Keep a full object (a load or a PATCH's answer) and its room's summary in step. */
export function putBridge(b: Bridge): void {
  setBridges('full', b.id, b);
  if (b.room_id) upsertSummary(b.room_id, b, b.space_id);
}

/** A bridge was deleted (by us or anyone): forget it everywhere. */
export function forgetBridge(id: string, roomId?: string): void {
  setBridges(
    produce((s) => {
      delete s.full[id];
    })
  );
  removeSummary(id, roomId);
}

// --- Consent -----------------------------------------------------------------------------

let accountInflight: Promise<void> | null = null;

/** Load the account default once (READY / GET /users/@me may already have said it). */
export function ensureAccountBridgeConsent(): Promise<void> {
  if (bridges.account !== undefined) return Promise.resolve();
  const fromProfile = auth.user?.bridge_consent;
  if (fromProfile) {
    setBridges('account', fromProfile);
    return Promise.resolve();
  }
  if (accountInflight) return accountInflight;
  accountInflight = getAccountBridgeConsent()
    .then((v) => {
      setBridges('account', v);
    })
    // An older server has no such route: nothing set is the honest answer.
    .catch(() => {
      setBridges('account', null);
    })
    .finally(() => {
      accountInflight = null;
    });
  return accountInflight;
}

export function setAccountConsentLocal(v: AccountBridgeConsent): void {
  setBridges('account', v);
  if (auth.user) setAuth('user', 'bridge_consent', v);
}

const spaceInflight = new Map<string, Promise<void>>();

/** Load the person's own choice for a space once. */
export function ensureSpaceBridgeConsent(spaceId: string): Promise<void> {
  if (!spaceId || bridges.bySpace[spaceId]) return Promise.resolve();
  const pending = spaceInflight.get(spaceId);
  if (pending) return pending;
  const p = getMySpaceBridgeConsent(spaceId)
    .then((r) => {
      setBridges('bySpace', spaceId, r);
    })
    .catch(() => {
      setBridges('bySpace', spaceId, { state: 'inherit' });
    })
    .finally(() => spaceInflight.delete(spaceId));
  spaceInflight.set(spaceId, p);
  return p;
}

export function setSpaceConsentLocal(spaceId: string, state: SpaceBridgeConsent): void {
  setBridges('bySpace', spaceId, (prev) => ({ ...(prev ?? {}), state }));
}

/** A space's mode: from the space object when it carries it, else from the consent read. */
export function spaceBridgeConsentMode(spaceId: string | undefined): BridgeConsentMode {
  if (!spaceId) return 'optout';
  const sp = spaces.spaces.find((s) => s.id === spaceId);
  // The space object, when its payload said the mode (null = opt-out); else the consent read.
  if (sp && sp.bridge_consent_mode !== undefined) return sp.bridge_consent_mode === 'optin' ? 'optin' : 'optout';
  return bridges.bySpace[spaceId]?.mode ?? 'optout';
}

export function setSpaceModeLocal(spaceId: string, mode: BridgeConsentMode): void {
  setSpaces('spaces', (s) => s.id === spaceId, 'bridge_consent_mode', mode === 'optin' ? 'optin' : null);
  setBridges('bySpace', spaceId, (prev) => ({ state: prev?.state ?? 'inherit', mode }));
}

/** Whether bridges copy the signed-in person's messages in this space. Reactive. */
export function myBridgeConsentIn(spaceId: string | undefined): 'allow' | 'deny' {
  return effectiveBridgeConsent({
    space: spaceId ? bridges.bySpace[spaceId]?.state : undefined,
    account: bridges.account ?? auth.user?.bridge_consent ?? null,
    mode: spaceBridgeConsentMode(spaceId),
  });
}

/** Drop what a client signing out must not keep. */
export function clearBridges(): void {
  setBridges({ full: {}, account: undefined, bySpace: {} });
  spaceInflight.clear();
  accountInflight = null;
}

// --- Gateway -----------------------------------------------------------------------------

function eventData(evt: { d: unknown }): Record<string, unknown> | undefined {
  const d = evt.d as Record<string, unknown> | undefined;
  // Some envelopes nest the payload once more (`{ d: { d: {...} } }`).
  const inner = d && typeof d.d === 'object' && d.d !== null && !('id' in d) ? (d.d as Record<string, unknown>) : d;
  return inner;
}

export function initBridgesHandler(): () => void {
  return onStargateEvent((evt) => {
    if (evt.t !== 'BRIDGE_CREATE' && evt.t !== 'BRIDGE_UPDATE' && evt.t !== 'BRIDGE_DELETE') return;
    const data = eventData(evt);
    const id = data?.id != null ? String(data.id) : data?.bridge_id != null ? String(data.bridge_id) : '';
    if (!id) return;
    const roomId = data?.room_id != null ? String(data.room_id) : evt.room_id ? String(evt.room_id) : undefined;
    const spaceId = data?.space_id != null ? String(data.space_id) : evt.space_id ? String(evt.space_id) : undefined;
    if (evt.t === 'BRIDGE_DELETE') {
      forgetBridge(id, roomId);
      return;
    }
    const summary = bridgeSummaryFromPayload(data);
    if (!summary || !roomId) return;
    upsertSummary(roomId, summary, spaceId);
    // A manager has the full object open: refetch it (the event carries the summary only).
    if (bridges.full[id]) void loadBridge(id).catch(() => undefined);
  });
}
