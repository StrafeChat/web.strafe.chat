/**
 * The space room list's drag-to-reorder behaviour: drag state, edge auto-scroll, the single
 * drop-guide line, and the commits that follow a drop.
 *
 * Pulled out of SpaceRoomsBar because it was roughly 500 lines of the component and touches
 * nothing else it renders. The arithmetic lives one level further down in lib/roomReorder;
 * this layer owns the reactive state and the DOM measuring, and takes everything it needs to
 * know about the room tree through `deps` so it stays independent of how the list is built.
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';
import { moveSpaceChannel, reorderSpaceRooms } from '../../../api/spaces';
import { refreshSpaceRooms } from '../../../stores/spaces';
import {
  SECTION_CHANNEL_LINE_INDENT_PX,
  ZONE_BOTTOM_FRAC,
  ZONE_TOP_FRAC,
  AUTOSCROLL_EDGE_PX,
  AUTOSCROLL_MAX_DELTA_PX,
  MIME_STRAFE_ROOM_REORDER,
  channelParentSectionId,
  computeChannelInsertInScope,
  computeReorderAfterDrop,
  moveIdBefore,
  moveIdToEnd,
  parseReorderPayload,
  resolveBandInstant,
  resolveHoverBand,
  sameStringOrder,
  type HoverBand,
  type ReorderPayload,
} from '../../../lib/roomReorder';

export interface RoomReorderDeps {
  spaceId: () => string | undefined;
  /** Reordering is a Manage rooms action; every commit re-checks it. */
  canManageRooms: () => boolean;
  /** Ids in display order for a scope: 'sections', 'top', or 'sec:<sectionId>'. */
  orderedIdsForScope: (scopeKey: string) => string[];
  /** The scrolling room list, for edge auto-scroll and keeping the guide line aligned. */
  scrollEl: () => HTMLElement | undefined;
}

export type RoomReorder = ReturnType<typeof createRoomReorder>;

export function createRoomReorder(deps: RoomReorderDeps) {
  /** Hysteresis state for the 25/50/25 hover zones; cleared whenever a drag starts or ends. */
  let reorderBandLatch: { rowKey: string; band: HoverBand } | null = null;

  /** Set on drag start so dragover can show a line without reading dataTransfer (often blocked). */
  const [activeReorderDrag, setActiveReorderDrag] = createSignal<ReorderPayload | null>(null);
  /** Line above `beforeId`, or full-width line at end of list when `atEnd` (targetScopeKey = row list). */
  const [dropIndicator, setDropIndicator] = createSignal<
    | { targetScopeKey: string; beforeId: string; collapsedInsideSectionId?: string }
    | { targetScopeKey: string; atEnd: true; collapsedInsideSectionId?: string }
    | null
  >(null);
  /** Single drop guide line (fixed px); only non-null while dragging with a valid insert position. */
  const [reorderLineRect, setReorderLineRect] = createSignal<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  /** Last pointer Y during native drag (document capture keeps updates when cursor leaves a row). */
  let lastDragClientY = 0;
  let roomsDragScrollRaf = 0;

  function stopRoomsDragAutoScrollLoop() {
    if (roomsDragScrollRaf) {
      cancelAnimationFrame(roomsDragScrollRaf);
      roomsDragScrollRaf = 0;
    }
  }

  function tickRoomsDragAutoScroll() {
    roomsDragScrollRaf = 0;
    const el = deps.scrollEl();
    if (!el || !activeReorderDrag()) return;
    const r = el.getBoundingClientRect();
    const y = lastDragClientY;
    const topLimit = r.top + AUTOSCROLL_EDGE_PX;
    const botLimit = r.bottom - AUTOSCROLL_EDGE_PX;
    let dy = 0;
    if (y < topLimit) {
      const over = topLimit - y;
      dy = -Math.min(AUTOSCROLL_MAX_DELTA_PX, 3 + over * 0.35);
    } else if (y > botLimit) {
      const over = y - botLimit;
      dy = Math.min(AUTOSCROLL_MAX_DELTA_PX, 3 + over * 0.35);
    }
    if (dy !== 0) {
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.max(0, Math.min(maxScroll, el.scrollTop + dy));
    }
    if ((y < topLimit || y > botLimit) && activeReorderDrag()) {
      roomsDragScrollRaf = requestAnimationFrame(tickRoomsDragAutoScroll);
    }
  }

  function ensureRoomsDragAutoScrollLoop() {
    if (!roomsDragScrollRaf) {
      roomsDragScrollRaf = requestAnimationFrame(tickRoomsDragAutoScroll);
    }
  }

  function maybeAutoScrollRoomsList(e: DragEvent) {
    lastDragClientY = e.clientY;
    ensureRoomsDragAutoScrollLoop();
  }

  createEffect(() => {
    const d = activeReorderDrag();
    if (!d) {
      stopRoomsDragAutoScrollLoop();
      return;
    }
    const onDocDragOver = (ev: Event) => {
      const de = ev as DragEvent;
      lastDragClientY = de.clientY;
      ensureRoomsDragAutoScrollLoop();
    };
    document.addEventListener('dragover', onDocDragOver, true);
    onCleanup(() => {
      document.removeEventListener('dragover', onDocDragOver, true);
      stopRoomsDragAutoScrollLoop();
    });
  });

  function setReorderDragActive(info: ReorderPayload | null) {
    reorderBandLatch = null;
    stopRoomsDragAutoScrollLoop();
    setDropIndicator(null);
    setReorderLineRect(null);
    setActiveReorderDrag(info);
  }

  async function submitRoomReorder(sid: string, body: Parameters<typeof reorderSpaceRooms>[1]) {
    await reorderSpaceRooms(sid, body);
    await refreshSpaceRooms(sid);
  }

  async function submitChannelMove(sid: string, channelId: string, targetScopeKey: string, beforeRoomId: string | null) {
    if (targetScopeKey !== 'top' && !targetScopeKey.startsWith('sec:')) return;
    const parent_section_id = targetScopeKey === 'top' ? null : targetScopeKey.slice(4);
    await moveSpaceChannel(sid, {
      channel_id: channelId,
      parent_section_id,
      before_room_id: beforeRoomId,
    });
    await refreshSpaceRooms(sid);
  }

  function runChannelMove(sid: string, channelId: string, targetScopeKey: string, beforeRoomId: string | null) {
    void submitChannelMove(sid, channelId, targetScopeKey, beforeRoomId).catch(() => {});
  }

  const orderedIdsForScope = (scopeKey: string): string[] => deps.orderedIdsForScope(scopeKey);

  type DropInd =
    | { targetScopeKey: string; beforeId: string; collapsedInsideSectionId?: string }
    | { targetScopeKey: string; atEnd: true; collapsedInsideSectionId?: string };

  function wouldReorderChangeOrder(scopeKey: string, dragId: string, d: DropInd): boolean {
    if (d.targetScopeKey !== scopeKey) return false;
    const ids = orderedIdsForScope(scopeKey);
    if (!ids.includes(dragId)) return false;
    if ('atEnd' in d) {
      return !sameStringOrder(ids, moveIdToEnd(ids, dragId));
    }
    return !sameStringOrder(ids, moveIdBefore(ids, dragId, d.beforeId));
  }

  function wouldChannelDropChangeOrder(sourceScopeKey: string, dragId: string, ind: DropInd): boolean {
    if (ind.collapsedInsideSectionId) {
      return channelParentSectionId(sourceScopeKey) !== ind.collapsedInsideSectionId;
    }
    if (channelParentSectionId(sourceScopeKey) !== channelParentSectionId(ind.targetScopeKey)) {
      return true;
    }
    const ids = orderedIdsForScope(ind.targetScopeKey);
    if (!ids.includes(dragId)) return false;
    if ('atEnd' in ind) {
      return !sameStringOrder(ids, moveIdToEnd(ids, dragId));
    }
    return !sameStringOrder(ids, moveIdBefore(ids, dragId, ind.beforeId));
  }

  function syncReorderLineGeometry() {
    const drag = activeReorderDrag();
    const ind = dropIndicator();
    if (!drag || !ind) {
      setReorderLineRect(null);
      return;
    }
    const inset = 4;
    try {
      if (drag.kind === 'section') {
        if (ind.targetScopeKey !== 'sections') {
          setReorderLineRect(null);
          return;
        }
        if (!wouldReorderChangeOrder('sections', drag.id, ind)) {
          setReorderLineRect(null);
          return;
        }
        if ('atEnd' in ind) {
          const el = document.querySelector(`[data-reorder-end="${ind.targetScopeKey}"]`);
          if (!el) {
            setReorderLineRect(null);
            return;
          }
          const r = el.getBoundingClientRect();
          setReorderLineRect({
            top: r.top + r.height / 2 - 1,
            left: r.left + inset,
            width: Math.max(0, r.width - inset * 2),
          });
          return;
        }
        const el = document.querySelector(
          `[data-reorder-anchor="${ind.targetScopeKey}"][data-reorder-id="${ind.beforeId}"]`
        );
        if (!el) {
          setReorderLineRect(null);
          return;
        }
        const r = el.getBoundingClientRect();
        setReorderLineRect({
          top: r.top - 1,
          left: r.left + inset,
          width: Math.max(0, r.width - inset * 2),
        });
        return;
      }
      if (!wouldChannelDropChangeOrder(drag.scopeKey, drag.id, ind)) {
        setReorderLineRect(null);
        return;
      }
      const secExtra = ind.targetScopeKey.startsWith('sec:') ? SECTION_CHANNEL_LINE_INDENT_PX : 0;
      if (ind.collapsedInsideSectionId) {
        const hel = document.querySelector(`[data-section-header="${ind.collapsedInsideSectionId}"]`);
        if (!hel) {
          setReorderLineRect(null);
          return;
        }
        const r = hel.getBoundingClientRect();
        setReorderLineRect({
          top: r.bottom + 1,
          left: r.left + inset + secExtra,
          width: Math.max(40, r.width - (inset + secExtra) * 2),
        });
        return;
      }
      if ('atEnd' in ind) {
        const el = document.querySelector(`[data-reorder-end="${ind.targetScopeKey}"]`);
        if (!el) {
          setReorderLineRect(null);
          return;
        }
        const r = el.getBoundingClientRect();
        setReorderLineRect({
          top: r.top + r.height / 2 - 1,
          left: r.left + inset + secExtra,
          width: Math.max(0, r.width - (inset + secExtra) * 2),
        });
        return;
      }
      const el = document.querySelector(
        `[data-reorder-anchor="${ind.targetScopeKey}"][data-reorder-id="${ind.beforeId}"]`
      );
      if (!el) {
        setReorderLineRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setReorderLineRect({
        top: r.top - 1,
        left: r.left + inset + secExtra,
        width: Math.max(0, r.width - (inset + secExtra) * 2),
      });
    } catch {
      setReorderLineRect(null);
    }
  }

  function updateDropIndicatorForRow(scopeKey: string, roomId: string, e: DragEvent) {
    const drag = activeReorderDrag();
    if (!drag) {
      setDropIndicator(null);
      queueMicrotask(() => syncReorderLineGeometry());
      return;
    }
    const row = e.currentTarget as HTMLElement;
    const rect = row.getBoundingClientRect();
    if (drag.kind === 'section') {
      if (drag.scopeKey !== scopeKey || scopeKey !== 'sections') {
        setDropIndicator(null);
        queueMicrotask(() => syncReorderLineGeometry());
        return;
      }
      const rowKey = `sections:${roomId}`;
      const { band, nextLatch } = resolveHoverBand(rowKey, e.clientX, e.clientY, rect, false, reorderBandLatch);
      reorderBandLatch = nextLatch;
      if (band === 'ABOVE') {
        setDropIndicator({ targetScopeKey: 'sections', beforeId: roomId });
      } else {
        const ids = orderedIdsForScope('sections');
        const i = ids.indexOf(roomId);
        if (i < 0) {
          setDropIndicator(null);
        } else if (i >= ids.length - 1) {
          setDropIndicator({ targetScopeKey: 'sections', atEnd: true });
        } else {
          setDropIndicator({ targetScopeKey: 'sections', beforeId: ids[i + 1]! });
        }
      }
      maybeAutoScrollRoomsList(e);
      queueMicrotask(() => syncReorderLineGeometry());
      return;
    }
    if (scopeKey !== 'top' && !scopeKey.startsWith('sec:')) {
      setDropIndicator(null);
      queueMicrotask(() => syncReorderLineGeometry());
      return;
    }
    const rowKey = `${scopeKey}:${roomId}`;
    const { band, nextLatch } = resolveHoverBand(rowKey, e.clientX, e.clientY, rect, false, reorderBandLatch);
    reorderBandLatch = nextLatch;
    if (band === 'ABOVE') {
      setDropIndicator({ targetScopeKey: scopeKey, beforeId: roomId });
    } else {
      const ids = orderedIdsForScope(scopeKey);
      const i = ids.indexOf(roomId);
      if (i < 0) {
        setDropIndicator(null);
      } else if (i >= ids.length - 1) {
        setDropIndicator({ targetScopeKey: scopeKey, atEnd: true });
      } else {
        setDropIndicator({ targetScopeKey: scopeKey, beforeId: ids[i + 1]! });
      }
    }
    maybeAutoScrollRoomsList(e);
    queueMicrotask(() => syncReorderLineGeometry());
  }

  function updateDropIndicatorForSectionHeader(sectionId: string, e: DragEvent, sectionIsOpen: boolean) {
    const drag = activeReorderDrag();
    if (!drag || drag.kind !== 'channel') {
      setDropIndicator(null);
      queueMicrotask(() => syncReorderLineGeometry());
      return;
    }
    const secScope = `sec:${sectionId}`;
    const kids = orderedIdsForScope(secScope);
    const headerEl = e.currentTarget as HTMLElement;
    const rect = headerEl.getBoundingClientRect();
    const rowKey = `sectionHeader:${sectionId}`;
    const { band, nextLatch } = resolveHoverBand(rowKey, e.clientX, e.clientY, rect, true, reorderBandLatch);
    reorderBandLatch = nextLatch;
    const secList = orderedIdsForScope('sections');
    const idx = secList.indexOf(sectionId);

    if (band === 'ABOVE') {
      setDropIndicator({ targetScopeKey: 'sections', beforeId: sectionId });
    } else if (band === 'BELOW') {
      if (idx >= 0 && idx < secList.length - 1) {
        setDropIndicator({ targetScopeKey: 'sections', beforeId: secList[idx + 1]! });
      } else {
        setDropIndicator({ targetScopeKey: 'sections', atEnd: true });
      }
    } else {
      if (!sectionIsOpen) {
        setDropIndicator({ targetScopeKey: secScope, atEnd: true, collapsedInsideSectionId: sectionId });
      } else if (kids.length === 0) {
        setDropIndicator({ targetScopeKey: secScope, atEnd: true });
      } else {
        const t25 = rect.top + rect.height * ZONE_TOP_FRAC;
        const t75 = rect.top + rect.height * ZONE_BOTTOM_FRAC;
        const span = Math.max(1e-6, t75 - t25);
        const inner = (e.clientY - t25) / span;
        if (inner < 0.5) {
          setDropIndicator({ targetScopeKey: secScope, beforeId: kids[0]! });
        } else {
          setDropIndicator({ targetScopeKey: secScope, atEnd: true });
        }
      }
    }
    maybeAutoScrollRoomsList(e);
    queueMicrotask(() => syncReorderLineGeometry());
  }

  function commitRoomOrder(scopeKey: string, room_ids: string[]) {
    const sid = deps.spaceId();
    if (!sid || !deps.canManageRooms()) return;
    let body: Parameters<typeof reorderSpaceRooms>[1];
    if (scopeKey === 'sections') {
      body = { scope: 'sections', room_ids };
    } else if (scopeKey === 'top') {
      body = { scope: 'channels', parent_section_id: null, room_ids };
    } else if (scopeKey.startsWith('sec:')) {
      const secId = scopeKey.slice(4);
      body = { scope: 'channels', parent_section_id: secId, room_ids };
    } else return;
    void submitRoomReorder(sid, body).catch(() => {});
  }

  function commitReorderFromDropEvent(e: DragEvent, scopeKey: string, targetId: string) {
    if (!deps.canManageRooms()) return;
    const parsed = parseReorderPayload(e.dataTransfer?.getData(MIME_STRAFE_ROOM_REORDER));
    if (!parsed) return;
    if (parsed.kind === 'section') {
      if (parsed.scopeKey !== scopeKey || scopeKey !== 'sections') return;
      const ids = orderedIdsForScope(scopeKey);
      const row = e.currentTarget as HTMLElement;
      const next = computeReorderAfterDrop(ids, parsed.id, targetId, e.clientY, e.clientX, row);
      if (!next || sameStringOrder(ids, next)) return;
      commitRoomOrder(scopeKey, next);
      return;
    }
    if (parsed.kind !== 'channel') return;
    if (scopeKey !== 'top' && !scopeKey.startsWith('sec:')) return;
    if (parsed.scopeKey === scopeKey) {
      const ids = orderedIdsForScope(scopeKey);
      const row = e.currentTarget as HTMLElement;
      const next = computeReorderAfterDrop(ids, parsed.id, targetId, e.clientY, e.clientX, row);
      if (!next || sameStringOrder(ids, next)) return;
      commitRoomOrder(scopeKey, next);
      return;
    }
    const sid = deps.spaceId();
    if (!sid) return;
    const ids = orderedIdsForScope(scopeKey);
    const row = e.currentTarget as HTMLElement;
    const ins = computeChannelInsertInScope(ids, parsed.id, targetId, e.clientY, e.clientX, row);
    if (!ins) return;
    runChannelMove(sid, parsed.id, scopeKey, ins.beforeRoomId);
  }

  function commitChannelMoveFromSectionHeaderDrop(e: DragEvent, sectionId: string, sectionIsOpen: boolean) {
    if (!deps.canManageRooms()) return;
    const sid = deps.spaceId();
    if (!sid) return;
    const parsed = parseReorderPayload(e.dataTransfer?.getData(MIME_STRAFE_ROOM_REORDER));
    if (!parsed || parsed.kind !== 'channel') return;
    const secScope = `sec:${sectionId}`;
    const kids = orderedIdsForScope(secScope);
    const headerEl = e.currentTarget as HTMLElement;
    const rect = headerEl.getBoundingClientRect();
    const band = resolveBandInstant(e.clientX, e.clientY, rect, true);
    const topFirst = deps.orderedIdsForScope('top')[0] ?? null;

    if (parsed.scopeKey === secScope) {
      if (band === 'ABOVE') {
        runChannelMove(sid, parsed.id, 'top', topFirst);
        return;
      }
      if (band === 'BELOW') {
        runChannelMove(sid, parsed.id, 'top', null);
        return;
      }
      if (!sectionIsOpen) {
        runChannelMove(sid, parsed.id, secScope, kids[0] ?? null);
        return;
      }
      if (kids.length === 0) {
        runChannelMove(sid, parsed.id, secScope, null);
        return;
      }
      const t25 = rect.top + rect.height * ZONE_TOP_FRAC;
      const t75 = rect.top + rect.height * ZONE_BOTTOM_FRAC;
      const span = Math.max(1e-6, t75 - t25);
      const inner = (e.clientY - t25) / span;
      if (inner < 0.5) {
        const next = moveIdBefore(kids, parsed.id, kids[0]!);
        if (!sameStringOrder(kids, next)) commitRoomOrder(secScope, next);
      } else {
        const next = moveIdToEnd(kids, parsed.id);
        if (!sameStringOrder(kids, next)) commitRoomOrder(secScope, next);
      }
      return;
    }

    if (band === 'ABOVE') {
      runChannelMove(sid, parsed.id, 'top', topFirst);
      return;
    }
    if (band === 'BELOW') {
      runChannelMove(sid, parsed.id, 'top', null);
      return;
    }
    if (!sectionIsOpen) {
      runChannelMove(sid, parsed.id, secScope, kids[0] ?? null);
      return;
    }
    if (kids.length === 0) {
      runChannelMove(sid, parsed.id, secScope, null);
      return;
    }
    const t25 = rect.top + rect.height * ZONE_TOP_FRAC;
    const t75 = rect.top + rect.height * ZONE_BOTTOM_FRAC;
    const span = Math.max(1e-6, t75 - t25);
    const inner = (e.clientY - t25) / span;
    const beforeRoomId = inner < 0.5 ? kids[0]! : null;
    runChannelMove(sid, parsed.id, secScope, beforeRoomId);
  }

  function commitReorderToEnd(scopeKey: string, dragId: string) {
    const sid = deps.spaceId();
    if (!sid || !deps.canManageRooms()) return;
    const ids = orderedIdsForScope(scopeKey);
    const next = moveIdToEnd(ids, dragId);
    if (sameStringOrder(ids, next)) return;
    commitRoomOrder(scopeKey, next);
  }

  function handleReorderStripDrop(e: DragEvent, scopeKey: string) {
    e.preventDefault();
    if (!deps.canManageRooms()) return;
    const parsed = parseReorderPayload(e.dataTransfer?.getData(MIME_STRAFE_ROOM_REORDER));
    if (!parsed) return;
    const sid = deps.spaceId();
    if (!sid) return;
    if (parsed.kind === 'section') {
      if (parsed.scopeKey !== scopeKey) return;
      commitReorderToEnd(scopeKey, parsed.id);
      return;
    }
    if (parsed.kind !== 'channel') return;
    if (scopeKey !== 'top' && !scopeKey.startsWith('sec:')) return;
    if (parsed.scopeKey === scopeKey) {
      commitReorderToEnd(scopeKey, parsed.id);
      return;
    }
    runChannelMove(sid, parsed.id, scopeKey, null);
  }

  /** Keep the single drop line aligned while scrolling or resizing during a drag. */
  createEffect(() => {
    if (!activeReorderDrag()) return;
    const sync = () => queueMicrotask(() => syncReorderLineGeometry());
    const scroller = deps.scrollEl();
    scroller?.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    onCleanup(() => {
      scroller?.removeEventListener('scroll', sync);
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    });
  });

  /** Clears the guide line (and re-measures) — for a dragover with no valid target. */
  function clearDropIndicator() {
    setDropIndicator(null);
    queueMicrotask(() => syncReorderLineGeometry());
  }

  /**
   * The thin strip under a list: dropping there appends to the end of that scope. A channel
   * may arrive from any scope (that is how it moves between sections); a section may only
   * come from the section list itself.
   */
  function handleEndStripDragOver(e: DragEvent, scopeKey: string, kind: ReorderPayload['kind'] = 'channel') {
    if (!deps.canManageRooms()) return;
    const d = activeReorderDrag();
    if (!d || d.kind !== kind || (kind === 'section' && d.scopeKey !== scopeKey)) {
      clearDropIndicator();
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    setDropIndicator({ targetScopeKey: scopeKey, atEnd: true });
    maybeAutoScrollRoomsList(e);
    queueMicrotask(() => syncReorderLineGeometry());
  }

  /** Section header dragover: a section reorders among sections, a channel moves in or past. */
  function handleSectionHeaderDragOver(e: DragEvent, sectionId: string, sectionIsOpen: boolean) {
    if (!deps.canManageRooms()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const d = activeReorderDrag();
    if (d?.kind === 'section') updateDropIndicatorForRow('sections', sectionId, e);
    else if (d?.kind === 'channel') updateDropIndicatorForSectionHeader(sectionId, e, sectionIsOpen);
    else clearDropIndicator();
    maybeAutoScrollRoomsList(e);
  }

  /** Section header drop: routes to the section reorder or the cross-parent channel move. */
  function handleSectionHeaderDrop(e: DragEvent, sectionId: string, sectionIsOpen: boolean) {
    e.preventDefault();
    if (!deps.canManageRooms()) return;
    const parsed = parseReorderPayload(e.dataTransfer?.getData(MIME_STRAFE_ROOM_REORDER));
    if (parsed?.kind === 'section') commitReorderFromDropEvent(e, 'sections', sectionId);
    else if (parsed?.kind === 'channel') commitChannelMoveFromSectionHeaderDrop(e, sectionId, sectionIsOpen);
  }

  return {
    activeReorderDrag,
    dropIndicator,
    reorderLineRect,
    setReorderDragActive,
    updateDropIndicatorForRow,
    updateDropIndicatorForSectionHeader,
    commitReorderFromDropEvent,
    commitChannelMoveFromSectionHeaderDrop,
    handleReorderStripDrop,
    handleEndStripDragOver,
    handleSectionHeaderDragOver,
    handleSectionHeaderDrop,
    clearDropIndicator,
  };
}
