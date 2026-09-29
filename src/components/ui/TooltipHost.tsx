import type { Component } from 'solid-js';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { zLayer } from '../../theme/appChrome';

/**
 * A single, app-wide custom tooltip.
 *
 * Every hover hint in the app funnels through this one host instead of the browser's native
 * `title` bubble (which we can't style, can't turn off on touch, and looks out of place). It
 * is driven by a `data-tooltip` attribute on any element - the <Tooltip> wrapper sets it, and
 * anywhere a `data-tooltip="..."` (optionally `data-tooltip-side="top|right|bottom|left"`) is
 * present the host shows the bubble on hover/focus.
 *
 * It also transparently adopts stray native `title` attributes: the first time you hover an
 * element that still has a `title`, its text is moved to `data-tooltip` and the `title` is
 * removed, so the ugly native tooltip never appears and the custom one shows instead. When the
 * element had no other accessible name, the text is preserved as `aria-label` so screen-reader
 * users lose nothing.
 *
 * The whole thing is disabled on devices that can't hover (touch phones/tablets): there, a
 * hover tooltip has no way to appear anyway, and the user asked for no tooltips on mobile. Only
 * one of these is ever mounted, at the app root.
 */

type Side = 'right' | 'left' | 'top' | 'bottom';

const GAP = 10;
const EDGE = 8;
const ARROW_INSET = 14;
/** Small delay so sweeping the pointer across a toolbar doesn't flash a bubble on each icon. */
const OPEN_DELAY_MS = 90;

interface Placement {
  top: number;
  left: number;
  side: Side;
  arrow: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

/** Reactive "this device can hover" - false on touch phones/tablets, where tooltips are off. */
function createCanHover() {
  const query = '(hover: hover) and (pointer: fine)';
  const [can, setCan] = createSignal(typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  onMount(() => {
    const mq = window.matchMedia(query);
    const update = () => setCan(mq.matches);
    update();
    mq.addEventListener('change', update);
    onCleanup(() => mq.removeEventListener('change', update));
  });
  return can;
}

function isSide(v: string | null): v is Side {
  return v === 'top' || v === 'right' || v === 'bottom' || v === 'left';
}

/** True when the element already conveys its name to assistive tech without the title. */
function hasAccessibleName(el: HTMLElement): boolean {
  if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
  if ((el.textContent ?? '').trim()) return true;
  const img = el.querySelector('img[alt]');
  if (img && (img.getAttribute('alt') ?? '').trim()) return true;
  return false;
}

/** Strip a native `title` so the browser bubble never shows and an explicit data-tooltip can
 * win. A non-empty title is adopted as `data-tooltip` (with an aria-label backfill when the
 * element had no other accessible name); an empty `title=""` - the codebase's "defer to a
 * wrapping <Tooltip>" marker (e.g. the MessageList hover toolbar) - is simply removed, leaving
 * the wrapper's data-tooltip to supply the label. */
function adoptNativeTitle(el: HTMLElement): void {
  // Leave semantic/native-name titles alone (iframe/abbr rely on them; SVG isn't HTMLElement).
  const tag = el.tagName;
  if (tag === 'IFRAME' || tag === 'ABBR') return;
  const title = el.getAttribute('title');
  if (title == null) return;
  if (title && el.getAttribute('data-tooltip') == null) {
    if (!hasAccessibleName(el)) el.setAttribute('aria-label', title);
    el.setAttribute('data-tooltip', title);
  }
  el.removeAttribute('title');
}

export const TooltipHost: Component = () => {
  const canHover = createCanHover();
  const [label, setLabel] = createSignal('');
  const [placement, setPlacement] = createSignal<Placement | null>(null);
  let bubbleEl: HTMLDivElement | undefined;
  let target: HTMLElement | null = null;
  let openTimer: number | undefined;

  function place() {
    if (!target || !bubbleEl || !target.isConnected) return;
    const r = target.getBoundingClientRect();
    const w = bubbleEl.offsetWidth;
    const h = bubbleEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const attr = target.getAttribute('data-tooltip-side');
    let side: Side = isSide(attr) ? attr : 'top';

    if (side === 'top' || side === 'bottom') {
      const fitsAbove = r.top - h - GAP >= EDGE;
      const fitsBelow = r.bottom + h + GAP <= vh - EDGE;
      if (side === 'top' && !fitsAbove && fitsBelow) side = 'bottom';
      else if (side === 'bottom' && !fitsBelow && fitsAbove) side = 'top';
      const top = side === 'top' ? r.top - h - GAP : r.bottom + GAP;
      const left = clamp(r.left + r.width / 2 - w / 2, EDGE, Math.max(EDGE, vw - w - EDGE));
      const arrow = clamp(r.left + r.width / 2 - left, ARROW_INSET, Math.max(ARROW_INSET, w - ARROW_INSET));
      setPlacement({ top: clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE)), left, side, arrow });
      return;
    }

    const fitsRight = r.right + w + GAP <= vw - EDGE;
    const fitsLeft = r.left - w - GAP >= EDGE;
    if (side === 'right' && !fitsRight && fitsLeft) side = 'left';
    else if (side === 'left' && !fitsLeft && fitsRight) side = 'right';
    const left = side === 'right' ? r.right + GAP : r.left - w - GAP;
    const top = clamp(r.top + r.height / 2 - h / 2, EDGE, Math.max(EDGE, vh - h - EDGE));
    const arrow = clamp(r.top + r.height / 2 - top, ARROW_INSET, Math.max(ARROW_INSET, h - ARROW_INSET));
    setPlacement({ top, left: clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE)), side, arrow });
  }

  function hide() {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = undefined;
    }
    target = null;
    setLabel('');
    setPlacement(null);
  }

  function openFor(el: HTMLElement) {
    const text = el.getAttribute('data-tooltip') ?? '';
    if (!text) {
      hide();
      return;
    }
    if (openTimer) clearTimeout(openTimer);
    target = el;
    openTimer = window.setTimeout(() => {
      openTimer = undefined;
      if (!target || !target.isConnected) return;
      setPlacement(null);
      setLabel(text);
      // Bubble must exist before it can be measured; one frame lets layout settle.
      requestAnimationFrame(place);
    }, OPEN_DELAY_MS);
  }

  /** The element whose tooltip should show for a pointer over `node`, or null. First strips the
   * nearest native title in the path (so it can't show a browser bubble or override a wrapper),
   * then returns the nearest explicit `data-tooltip` - a <Tooltip> wrapper, or a title just
   * adopted into one. This is what lets an outer <Tooltip label> win over an inner control that
   * carries only `title=""`. */
  function hostFrom(node: EventTarget | null): HTMLElement | null {
    if (!(node instanceof Element)) return null;
    const titled = node.closest('[title]');
    if (titled instanceof HTMLElement) adoptNativeTitle(titled);
    const host = node.closest('[data-tooltip]');
    return host instanceof HTMLElement ? host : null;
  }

  onMount(() => {
    const onOver = (e: PointerEvent) => {
      if (!canHover()) return;
      const host = hostFrom(e.target);
      if (host === target) return;
      if (host) openFor(host);
      else hide();
    };
    const onOut = (e: PointerEvent) => {
      if (!target) return;
      const to = e.relatedTarget as Node | null;
      if (to && target.contains(to)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!canHover()) return;
      const host = hostFrom(e.target);
      if (host) openFor(host);
      else hide();
    };
    const onScroll = () => (target ? place() : undefined);
    const onDown = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    onCleanup(() => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (openTimer) clearTimeout(openTimer);
    });
  });

  return (
    <Show when={canHover() && label()}>
      <Portal>
        <div
          ref={(el) => (bubbleEl = el)}
          role="tooltip"
          class={`pointer-events-none fixed ${zLayer.popover}`}
          style={{
            top: `${placement()?.top ?? 0}px`,
            left: `${placement()?.left ?? 0}px`,
            visibility: placement() ? 'visible' : 'hidden',
          }}
        >
          <div class="relative flex items-center whitespace-nowrap rounded-md border border-border bg-popover/95 px-3 py-2 text-sm font-medium text-popover-foreground shadow-2xl shadow-black/40 backdrop-blur-xl">
            <Show when={placement()}>
              {(p) => (
                <Show
                  when={p().side === 'top' || p().side === 'bottom'}
                  fallback={
                    <div
                      class={`absolute h-0 w-0 -translate-y-1/2 border-y-[6px] border-y-transparent ${
                        p().side === 'left'
                          ? 'left-full border-l-[6px] border-l-popover'
                          : 'right-full border-r-[6px] border-r-popover'
                      }`}
                      style={{ top: `${p().arrow}px` }}
                    />
                  }
                >
                  <div
                    class={`absolute h-0 w-0 -translate-x-1/2 border-x-[6px] border-x-transparent ${
                      p().side === 'top'
                        ? 'top-full -mt-px border-t-[6px] border-t-popover'
                        : 'bottom-full -mb-px border-b-[6px] border-b-popover'
                    }`}
                    style={{ left: `${p().arrow}px` }}
                  />
                </Show>
              )}
            </Show>
            {label()}
          </div>
        </div>
      </Portal>
    </Show>
  );
};
