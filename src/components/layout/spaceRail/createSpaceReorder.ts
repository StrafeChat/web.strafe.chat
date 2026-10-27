import { createSignal, onCleanup, type JSX } from 'solid-js';

export interface SpaceReorderOptions {
  container: () => HTMLElement | undefined;
  ids: (draggedId: string | null) => string[];
  onCommit: (ids: string[], draggedId: string) => void;
  onDragMove?: (info: { id: string; x: number; y: number }) => void;
  onDragEnd?: (info: { id: string; committed: boolean; cancelled: boolean }) => void;
  shouldReorder?: () => boolean;
  shouldCommit?: (id: string) => boolean;
  unbounded?: (draggedId: string | null) => boolean;
}

export interface SpaceReorder {
  draggingId: () => string | null;
  start: (e: PointerEvent, id: string, el: HTMLElement) => void;
  styleFor: (id: string) => JSX.CSSProperties;
}

const MOVE_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 48;
const AUTOSCROLL_MAX_PX = 14;
const DROP_EASE = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function createSpaceReorder(opts: SpaceReorderOptions): SpaceReorder {
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dragDy, setDragDy] = createSignal(0);
  const [shifts, setShifts] = createSignal<Record<string, number>>({});
  const [settling, setSettling] = createSignal(false);

  let pendingId: string | null = null;
  let started = false;
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let grabDelta = 0;
  let centreOffset = 24;
  let handleEl: HTMLElement | null = null;
  let itemGap = 8;
  let homeTops: Record<string, number> = {};
  let homeHeights: Record<string, number> = {};
  let orderAtStart: string[] = [];
  let finalOrder: string[] | null = null;
  let scrollRaf = 0;

  function slotFor(id: string): HTMLElement | null {
    const container = opts.container();
    if (!container) return null;
    return container.querySelector<HTMLElement>(`[data-rail-id="${CSS.escape(id)}"]`);
  }

  function measure(draggedId: string) {
    const container = opts.container();
    orderAtStart = [...opts.ids(draggedId)];
    homeTops = {};
    homeHeights = {};
    if (!container) {
      itemGap = 8;
      return;
    }
    const box = container.getBoundingClientRect();
    for (const id of orderAtStart) {
      const el = slotFor(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      homeTops[id] = r.top - box.top + container.scrollTop;
      homeHeights[id] = r.height;
    }
    itemGap = 8;
    for (let i = 1; i < orderAtStart.length; i++) {
      const prev = orderAtStart[i - 1]!;
      const current = orderAtStart[i]!;
      if (homeTops[prev] === undefined || homeTops[current] === undefined) continue;
      itemGap = homeTops[current] - (homeTops[prev] + (homeHeights[prev] ?? 48));
      break;
    }
  }

  function beginDrag() {
    started = true;
    const id = pendingId;
    if (!id) return;
    const el = slotFor(id);
    if (el) {
      const rootRect = el.getBoundingClientRect();
      grabDelta = startY - rootRect.top;
      const handleRect = handleEl?.isConnected ? handleEl.getBoundingClientRect() : null;
      centreOffset = handleRect ? handleRect.top - rootRect.top + handleRect.height / 2 : rootRect.height / 2;
    }
    measure(id);
    finalOrder = [...orderAtStart];
    setDraggingId(id);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    update();
  }

  function update(preview = true) {
    const id = pendingId;
    const container = opts.container();
    if (!id || !container) return;
    const box = container.getBoundingClientRect();
    const pointerContentY = lastY - box.top + container.scrollTop;
    const rawTargetTop = pointerContentY - grabDelta;
    const firstTop = homeTops[orderAtStart[0] ?? ''];
    const lastTop = homeTops[orderAtStart[orderAtStart.length - 1] ?? ''];
    let targetTop = rawTargetTop;
    if (!(opts.unbounded?.(id) ?? false) && firstTop !== undefined && lastTop !== undefined) {
      targetTop = Math.max(firstTop, Math.min(lastTop, rawTargetTop));
    }
    setDragDy(targetTop - (homeTops[id] ?? targetTop));
    if (!preview) return;

    const centre = rawTargetTop + centreOffset;
    const without = orderAtStart.filter((x) => x !== id);
    let insertAt = 0;
    for (const other of without) {
      const otherCentre = (homeTops[other] ?? 0) + (homeHeights[other] ?? 48) / 2;
      if (otherCentre < centre) insertAt++;
    }
    const next = [...without];
    next.splice(insertAt, 0, id);
    finalOrder = next;

    const shiftBy: Record<string, number> = {};
    let cursor = firstTop ?? 0;
    for (const other of next) {
      const top = homeTops[other];
      if (other !== id && top !== undefined) shiftBy[other] = cursor - top;
      cursor += (homeHeights[other] ?? 48) + itemGap;
    }
    setShifts(shiftBy);
  }

  function finish(commit: boolean) {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown, true);
    if (scrollRaf) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    const didDrag = started;
    const draggedId = pendingId;
    const order = finalOrder;
    pendingId = null;
    started = false;
    finalOrder = null;
    if (didDrag) setSettling(true);
    setDraggingId(null);
    setDragDy(0);
    setShifts({});

    if (didDrag) {
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 0);
    }

    const canCommit =
      didDrag &&
      commit &&
      !!order &&
      !!draggedId &&
      !sameOrder(order, orderAtStart) &&
      (opts.shouldCommit?.(draggedId) ?? true);
    if (canCommit && order && draggedId) opts.onCommit(order, draggedId);
    if (didDrag && draggedId) opts.onDragEnd?.({ id: draggedId, committed: canCommit, cancelled: !commit });
    if (didDrag) {
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    }
  }

  function autoScrollTick() {
    scrollRaf = 0;
    const container = opts.container();
    if (!started || !container) return;
    const box = container.getBoundingClientRect();
    let dy = 0;
    if (lastY < box.top + AUTOSCROLL_EDGE_PX) {
      dy = -Math.min(AUTOSCROLL_MAX_PX, (box.top + AUTOSCROLL_EDGE_PX - lastY) * 0.3 + 2);
    } else if (lastY > box.bottom - AUTOSCROLL_EDGE_PX) {
      dy = Math.min(AUTOSCROLL_MAX_PX, (lastY - (box.bottom - AUTOSCROLL_EDGE_PX)) * 0.3 + 2);
    }
    if (dy !== 0) {
      const max = Math.max(0, container.scrollHeight - container.clientHeight);
      const next = Math.max(0, Math.min(max, container.scrollTop + dy));
      if (next !== container.scrollTop) {
        container.scrollTop = next;
        update(opts.shouldReorder?.() ?? true);
      }
      scrollRaf = requestAnimationFrame(autoScrollTick);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!pendingId) return;
    lastY = e.clientY;
    if (!started) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < MOVE_THRESHOLD_PX) return;
      beginDrag();
    }
    if (pendingId) opts.onDragMove?.({ id: pendingId, x: e.clientX, y: e.clientY });
    update(opts.shouldReorder?.() ?? true);
    if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function onPointerUp() {
    finish(true);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  }

  function start(e: PointerEvent, id: string, el: HTMLElement) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    pendingId = id;
    started = false;
    startX = e.clientX;
    startY = e.clientY;
    lastY = e.clientY;
    handleEl = el;
    grabDelta = e.clientY - el.getBoundingClientRect().top;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function styleFor(id: string): JSX.CSSProperties {
    if (draggingId() === id) {
      return {
        transform: `translateY(${dragDy()}px) scale(1.06)`,
        transition: 'none',
        'z-index': '20',
        position: 'relative',
        'will-change': 'transform',
        'pointer-events': 'none',
      };
    }
    const shift = shifts()[id] ?? 0;
    return {
      transform: shift ? `translateY(${shift}px)` : '',
      transition: settling() ? 'none' : DROP_EASE,
      ...(shift ? { 'will-change': 'transform' } : {}),
    };
  }

  onCleanup(() => {
    if (pendingId) finish(false);
  });

  return { draggingId, start, styleFor };
}
