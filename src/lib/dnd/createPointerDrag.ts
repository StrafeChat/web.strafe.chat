import { createSignal, onCleanup } from 'solid-js';

/**
 * A pointer-based drag primitive for reorderable lists - the smooth, Discord-style alternative to
 * native HTML5 drag-and-drop (whose translucent browser "ghost" we can't style and which behaves
 * badly on touch). It owns the mechanics both the room list and the role list share:
 *
 *  - press-and-move to start (a small threshold, so a click still selects),
 *  - a floating preview cloned from the grabbed row that tracks the cursor,
 *  - edge auto-scroll of a container, and
 *  - Escape / pointer-up to cancel / commit.
 *
 * Everything list-specific - which gap the cursor is over, and what a drop commits - is supplied by
 * the caller through `onMove` / `onDrop`, so the same primitive drives a flat list and a sectioned
 * one. The preview has `pointer-events: none`, so `document.elementFromPoint` in `onMove` still hits
 * the row underneath it.
 */

export interface PointerDragOptions {
  /** Dragging only starts when this returns true (permission + not busy). */
  enabled?: () => boolean;
  /** The scrolling container to edge-auto-scroll while dragging. */
  scrollEl?: () => HTMLElement | undefined;
  /** Fired once, when a drag actually begins (past the movement threshold). */
  onStart?: (id: string) => void;
  /** Fired on each pointer move (and each auto-scroll frame) while dragging. */
  onMove: (id: string, clientX: number, clientY: number) => void;
  /** Fired on pointer-up; the caller commits from whatever drop target it tracked in onMove. */
  onDrop: (id: string) => void;
  /** Fired after every drag ends (commit or cancel) - clear any drop indicator here. */
  onEnd?: () => void;
}

export interface PointerDragController {
  /** Wire to a drag handle's onPointerDown. `rowEl` is cloned for the floating preview. */
  start: (e: PointerEvent, id: string, rowEl: HTMLElement) => void;
  /** The id currently being dragged, or null. */
  draggingId: () => string | null;
}

const MOVE_THRESHOLD_PX = 5;
const AUTOSCROLL_EDGE_PX = 52;
const AUTOSCROLL_MAX_PX = 16;

export function createPointerDrag(opts: PointerDragOptions): PointerDragController {
  const [draggingId, setDraggingId] = createSignal<string | null>(null);

  let pendingId: string | null = null;
  let started = false;
  let startX = 0;
  let startY = 0;
  let grabDX = 0;
  let grabDY = 0;
  let lastX = 0;
  let lastY = 0;
  let sourceEl: HTMLElement | null = null;
  let preview: HTMLElement | null = null;
  let scrollRaf = 0;

  function start(e: PointerEvent, id: string, rowEl: HTMLElement) {
    if (opts.enabled && !opts.enabled()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Suppress only the mouse default (starting a text selection). Leave touch alone so a scroll
    // gesture on a whole-row handle still scrolls (it fires pointercancel and the drag never begins).
    if (e.pointerType === 'mouse') e.preventDefault();
    pendingId = id;
    started = false;
    sourceEl = rowEl;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    const r = rowEl.getBoundingClientRect();
    grabDX = e.clientX - r.left;
    grabDY = e.clientY - r.top;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function beginDrag(id: string) {
    started = true;
    setDraggingId(id);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    if (sourceEl) {
      const r = sourceEl.getBoundingClientRect();
      const clone = sourceEl.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '99999',
        opacity: '0.96',
        transform: 'scale(1.03)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        borderRadius: '0.6rem',
        background: 'var(--color-popover)',
        transition: 'none',
      } as Partial<CSSStyleDeclaration>);
      clone.setAttribute('aria-hidden', 'true');
      preview = clone;
      document.body.appendChild(clone);
    }
    opts.onStart?.(id);
  }

  function onPointerMove(e: PointerEvent) {
    const id = pendingId;
    if (!id) return;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!started) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < MOVE_THRESHOLD_PX) return;
      beginDrag(id);
    }
    if (preview) {
      preview.style.left = `${e.clientX - grabDX}px`;
      preview.style.top = `${e.clientY - grabDY}px`;
    }
    opts.onMove(id, e.clientX, e.clientY);
    ensureAutoScroll();
  }

  function ensureAutoScroll() {
    if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function autoScrollTick() {
    scrollRaf = 0;
    if (!started || !pendingId) return;
    const el = opts.scrollEl?.();
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dy = 0;
    if (lastY < r.top + AUTOSCROLL_EDGE_PX) {
      dy = -Math.min(AUTOSCROLL_MAX_PX, (r.top + AUTOSCROLL_EDGE_PX - lastY) * 0.3 + 2);
    } else if (lastY > r.bottom - AUTOSCROLL_EDGE_PX) {
      dy = Math.min(AUTOSCROLL_MAX_PX, (lastY - (r.bottom - AUTOSCROLL_EDGE_PX)) * 0.3 + 2);
    }
    if (dy !== 0) {
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      const next = Math.max(0, Math.min(max, el.scrollTop + dy));
      if (next !== el.scrollTop) {
        el.scrollTop = next;
        // The rows moved under a stationary cursor - re-evaluate the drop target.
        opts.onMove(pendingId, lastX, lastY);
      }
      scrollRaf = requestAnimationFrame(autoScrollTick);
    }
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
    if (preview) {
      preview.remove();
      preview = null;
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const id = pendingId;
    const didDrag = started;
    pendingId = null;
    started = false;
    sourceEl = null;
    setDraggingId(null);
    if (didDrag) {
      // A real drag just ended: swallow the click the pointer-up would otherwise fire (so a
      // whole-row drag handle doesn't also navigate). Removed on the next tick, after that click.
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', swallow, true);
      setTimeout(() => document.removeEventListener('click', swallow, true), 0);
    }
    if (didDrag && id && commit) opts.onDrop(id);
    if (didDrag) opts.onEnd?.();
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

  onCleanup(() => {
    if (pendingId) finish(false);
  });

  return { start, draggingId };
}
