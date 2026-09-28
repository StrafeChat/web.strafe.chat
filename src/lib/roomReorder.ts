/**
 * Drag-and-drop reordering maths for the space room list.
 *
 * Deliberately free of Solid and of any app store: everything here is a pure function of a
 * pointer position, a rectangle and a list of ids, which is what makes the fiddly parts
 * (hysteresis between hover bands, inserting across parents) testable and reviewable on
 * their own. SpaceRoomsBar owns the state and the DOM; this owns the arithmetic.
 */

export const MIME_STRAFE_ROOM_REORDER = 'text/x-strafe-reorder';

/** Vertical zones: top 25% ABOVE, middle 50% INSIDE (when allowed), bottom 25% BELOW (Discord-style). */
export const ZONE_TOP_FRAC = 0.25;
export const ZONE_BOTTOM_FRAC = 0.75;
export const HYSTERESIS_PX = 8;
/** Cursor this far past row left edge keeps INSIDE in the middle band (else treat as ABOVE/BELOW). */
export const INSIDE_X_BIAS_PX = 26;
/** Extra left inset for the drop line when inserting into a section’s channel list. */
export const SECTION_CHANNEL_LINE_INDENT_PX = 10;
export const AUTOSCROLL_EDGE_PX = 40;
/** Speed scales with distance past the edge zone (px/frame, capped). */
export const AUTOSCROLL_MAX_DELTA_PX = 22;

export type HoverBand = 'ABOVE' | 'INSIDE' | 'BELOW';

export function moveIdBefore(ids: string[], dragId: string, beforeId: string): string[] {
  if (dragId === beforeId) return ids;
  const filtered = ids.filter((x) => x !== dragId);
  const ti = filtered.indexOf(beforeId);
  if (ti < 0) return ids;
  return [...filtered.slice(0, ti), dragId, ...filtered.slice(ti)];
}

export function moveIdToEnd(ids: string[], dragId: string): string[] {
  if (!ids.includes(dragId)) return ids;
  return [...ids.filter((x) => x !== dragId), dragId];
}

/** What a row puts on the dataTransfer when a drag starts. */
export interface ReorderPayload {
  kind: 'channel' | 'section';
  scopeKey: string;
  id: string;
}

export function parseReorderPayload(raw: string | undefined): ReorderPayload | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { kind?: string; scopeKey?: string; id?: string };
    if (typeof o.scopeKey !== 'string' || typeof o.id !== 'string') return null;
    const kind: ReorderPayload['kind'] = o.kind === 'section' ? 'section' : 'channel';
    return { kind, scopeKey: o.scopeKey, id: o.id };
  } catch {
    /* ignore */
  }
  return null;
}

export function sameStringOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function rawVerticalBand(clientY: number, rect: DOMRect, allowInside: boolean): HoverBand {
  const h = rect.height;
  if (h <= 1) return 'BELOW';
  const y0 = clientY - rect.top;
  const t = y0 / h;
  if (t < ZONE_TOP_FRAC) return 'ABOVE';
  if (t > ZONE_BOTTOM_FRAC) return 'BELOW';
  if (allowInside) return 'INSIDE';
  return t < 0.5 ? 'ABOVE' : 'BELOW';
}

/** Far-left in the middle band → ABOVE/BELOW by vertical half; indented → keep INSIDE. */
export function applyInsideHorizontalBias(
  band: HoverBand,
  clientX: number,
  clientY: number,
  rect: DOMRect
): HoverBand {
  if (band !== 'INSIDE') return band;
  if (clientX > rect.left + INSIDE_X_BIAS_PX) return 'INSIDE';
  const mid = rect.top + rect.height / 2;
  return clientY < mid ? 'ABOVE' : 'BELOW';
}

export function adoptBandAfterHysteresis(rect: DOMRect, clientY: number, prev: HoverBand, raw: HoverBand): HoverBand {
  if (prev === raw) return raw;
  const h = rect.height;
  const t25 = rect.top + h * ZONE_TOP_FRAC;
  const t75 = rect.top + h * ZONE_BOTTOM_FRAC;
  const hy = HYSTERESIS_PX;
  if (prev === 'INSIDE') {
    if (raw === 'INSIDE') return 'INSIDE';
    if (raw === 'ABOVE' && clientY <= t25 + hy) return 'ABOVE';
    if (raw === 'BELOW' && clientY >= t75 - hy) return 'BELOW';
    if (clientY < t25 - hy) return raw;
    if (clientY > t75 + hy) return raw;
    return 'INSIDE';
  }
  if (prev === 'ABOVE') {
    if (raw === 'ABOVE') return 'ABOVE';
    if (clientY < t25 + hy) return 'ABOVE';
    return raw;
  }
  if (prev === 'BELOW') {
    if (raw === 'BELOW') return 'BELOW';
    if (clientY > t75 - hy) return 'BELOW';
    return raw;
  }
  return raw;
}

export function resolveHoverBand(
  rowKey: string,
  clientX: number,
  clientY: number,
  rect: DOMRect,
  allowInside: boolean,
  latch: { rowKey: string; band: HoverBand } | null
): { band: HoverBand; nextLatch: { rowKey: string; band: HoverBand } } {
  let raw = rawVerticalBand(clientY, rect, allowInside);
  raw = applyInsideHorizontalBias(raw, clientX, clientY, rect);
  if (!latch || latch.rowKey !== rowKey) {
    return { band: raw, nextLatch: { rowKey, band: raw } };
  }
  const adopted = adoptBandAfterHysteresis(rect, clientY, latch.band, raw);
  return { band: adopted, nextLatch: { rowKey, band: adopted } };
}

/** Commit-time zone (no hysteresis) so drop matches the last committed hover intent. */
export function resolveBandInstant(clientX: number, clientY: number, rect: DOMRect, allowInside: boolean): HoverBand {
  let raw = rawVerticalBand(clientY, rect, allowInside);
  raw = applyInsideHorizontalBias(raw, clientX, clientY, rect);
  return raw;
}

/** Insert position from pointer vs row bounds (25/50/25 when dragging over same list). */
export function computeReorderAfterDrop(
  ids: string[],
  dragId: string,
  targetId: string,
  clientY: number,
  _clientX: number,
  rowEl: HTMLElement
): string[] | null {
  if (!ids.includes(dragId) || !ids.includes(targetId)) return null;
  const rect = rowEl.getBoundingClientRect();
  const band = rawVerticalBand(clientY, rect, false);
  const above = band === 'ABOVE';
  if (dragId === targetId) {
    if (above) return ids;
    const i = ids.indexOf(targetId);
    if (i < 0) return null;
    if (i >= ids.length - 1) return moveIdToEnd(ids, dragId);
    return moveIdBefore(ids, dragId, ids[i + 1]);
  }
  if (above) return moveIdBefore(ids, dragId, targetId);
  const i = ids.indexOf(targetId);
  if (i < 0) return null;
  if (i >= ids.length - 1) return moveIdToEnd(ids, dragId);
  return moveIdBefore(ids, dragId, ids[i + 1]);
}

/** Target sibling list for a channel scope (`top` = top-level, `sec:id` = under section). */
export function channelParentSectionId(scopeKey: string): string | null {
  if (scopeKey === 'top') return null;
  if (scopeKey.startsWith('sec:')) return scopeKey.slice(4);
  return null;
}

/** Insert channel into a target scope list (drag id may be absent from `targetIds` when moving across parents). */
export function computeChannelInsertInScope(
  targetIds: string[],
  dragId: string,
  targetRoomId: string,
  clientY: number,
  _clientX: number,
  rowEl: HTMLElement
): { beforeRoomId: string | null } | null {
  const ti = targetIds.indexOf(targetRoomId);
  if (ti < 0) return null;
  const rect = rowEl.getBoundingClientRect();
  const band = rawVerticalBand(clientY, rect, false);
  const above = band === 'ABOVE';
  let insertIdx: number;
  if (above) {
    insertIdx = ti;
  } else {
    insertIdx = ti + 1;
  }
  const next = [...targetIds.slice(0, insertIdx), dragId, ...targetIds.slice(insertIdx)];
  const di = next.indexOf(dragId);
  if (di < 0) return null;
  const beforeRoomId = di < next.length - 1 ? next[di + 1]! : null;
  return { beforeRoomId };
}
