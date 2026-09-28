/**
 * Touch swipe navigation for the mobile shell pager.
 *
 * Discord's app lets you drag anywhere in the chat to pull the channel list back out, not
 * just from the screen edge, so this listens on the whole shell. The cost of that is having
 * to be careful about what a horizontal drag might already mean to whatever is under the
 * finger: a scrollable code block, a table, a media scrubber. Those opt out below.
 */

import type { MobilePanel } from '../stores/mobileShellLayout';

export interface SwipeNavOptions {
  /** Pager off entirely (desktop widths). */
  enabled: () => boolean;
  /** How far one panel step moves, in px - one viewport width. */
  width: () => number;
  panel: () => MobilePanel;
  setPanel: (panel: MobilePanel) => void;
  /** Whether the room on screen has a member list to swipe left into. */
  membersAvailable: () => boolean;
  membersOpen: () => boolean;
  setMembersOpen: (open: boolean) => void;
  setOffset: (px: number) => void;
  setActive: (active: boolean) => void;
}

/** Movement before we decide a gesture is a horizontal swipe rather than a scroll. */
const DECIDE_PX = 12;
/** Fraction of a panel that has to be dragged for the swipe to commit on release. */
const COMMIT_FRACTION = 0.28;
const COMMIT_MAX_PX = 140;
/** A quick flick commits even when it didn't travel far (px per ms). */
const FLICK_VELOCITY = 0.45;

/** Elements that own horizontal movement outright, whichever way the finger goes. */
function isHorizontalWidget(el: Element): boolean {
  if (el.hasAttribute('data-no-swipe')) return true;
  const tag = el.tagName;
  if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'CANVAS') return true;
  if (tag === 'INPUT' && (el as HTMLInputElement).type === 'range') return true;
  return el.getAttribute('role') === 'slider';
}

/**
 * True when something under the finger should get this gesture instead of the pager.
 *
 * Direction matters: a code block scrolled to its start owns a leftward swipe (it still
 * has content to reveal) but not a rightward one. Checking that rather than "is scrollable
 * at all" also sidesteps a CSS trap - `overflow-y: auto` alone computes `overflow-x` to
 * `auto`, so almost every vertical scroller would otherwise look like it owns sideways
 * drags and the pager would never move.
 */
const SCROLL_SLACK = 8;

function ownsHorizontalGesture(target: EventTarget | null, dx: number): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (isHorizontalWidget(el)) return true;
    const max = el.scrollWidth - el.clientWidth;
    if (max > SCROLL_SLACK) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        if (dx < 0 && el.scrollLeft < max - 1) return true;
        if (dx > 0 && el.scrollLeft > 1) return true;
      }
    }
    el = el.parentElement;
  }
  return false;
}

export function attachSwipeNavigation(el: HTMLElement, o: SwipeNavOptions): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastTime = 0;
  let decided: 'swipe' | 'ignore' | null = null;
  let origin: EventTarget | null = null;

  function reset() {
    pointerId = null;
    decided = null;
    origin = null;
    o.setActive(false);
    o.setOffset(0);
  }

  function onPointerDown(e: PointerEvent) {
    if (!o.enabled() || e.pointerType !== 'touch' || !e.isPrimary) return;
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    origin = e.target;
    startX = e.clientX;
    startY = e.clientY;
    startTime = lastTime = e.timeStamp;
    decided = null;
  }

  function onPointerMove(e: PointerEvent) {
    if (pointerId !== e.pointerId || !o.enabled()) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (decided === null) {
      if (Math.abs(dy) > DECIDE_PX && Math.abs(dy) >= Math.abs(dx)) {
        decided = 'ignore';
        return;
      }
      if (Math.abs(dx) > DECIDE_PX && Math.abs(dx) > Math.abs(dy)) {
        // Now that the direction is known, see whether something under the finger wants
        // this drag for itself.
        if (ownsHorizontalGesture(origin, dx)) {
          decided = 'ignore';
          return;
        }
        decided = 'swipe';
        o.setActive(true);
      } else {
        return;
      }
    }
    if (decided !== 'swipe') return;
    lastTime = e.timeStamp;
    // The member drawer and the "nowhere to go" directions don't move the pager, but the
    // gesture is still tracked so the release can act on it.
    const w = o.width();
    const base = o.panel() === 'nav' ? 0 : w;
    const shift = Math.max(0, Math.min(w, base - dx));
    o.setOffset(base - shift);
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    if (decided !== 'swipe') {
      reset();
      return;
    }
    const dx = e.clientX - startX;
    const elapsed = Math.max(1, (e.timeStamp || lastTime) - startTime);
    const velocity = (e.clientX - startX) / elapsed;
    const threshold = Math.min(o.width() * COMMIT_FRACTION, COMMIT_MAX_PX);
    const forward = dx <= -threshold || velocity <= -FLICK_VELOCITY;
    const back = dx >= threshold || velocity >= FLICK_VELOCITY;

    if (o.membersOpen()) {
      if (back) o.setMembersOpen(false);
    } else if (o.panel() === 'nav') {
      if (forward) o.setPanel('content');
    } else if (back) {
      o.setPanel('nav');
    } else if (forward && o.membersAvailable()) {
      o.setMembersOpen(true);
    }
    reset();
  }

  function onPointerCancel(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    reset();
  }

  el.addEventListener('pointerdown', onPointerDown, { passive: true });
  el.addEventListener('pointermove', onPointerMove, { passive: false });
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
  };
}
