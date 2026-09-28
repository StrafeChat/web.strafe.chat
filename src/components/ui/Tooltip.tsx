import type { Component } from 'solid-js';
import { createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { zLayer } from '../../theme/appChrome';

type Side = 'right' | 'left' | 'top' | 'bottom';

interface TooltipProps {
  label: string;
  children: import('solid-js').JSX.Element;
  /** Preferred side. The tooltip flips to the opposite side when that one doesn't fit. */
  side?: Side;
  /** When true, wrapper does not take full width (e.g. for icon rows). */
  inline?: boolean;
}

/** Distance between the trigger and the bubble (leaves room for the arrow). */
const GAP = 10;
/** Keep this far from the viewport edges. */
const EDGE = 8;
/** How close the arrow may sit to a corner of the bubble. */
const ARROW_INSET = 14;

interface Placement {
  top: number;
  left: number;
  side: Side;
  /** Arrow offset along the bubble's cross axis, in px from its top/left corner. */
  arrow: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

/**
 * Hover label. Positioning is measured rather than assumed: the bubble is rendered
 * invisibly, measured, then flipped to the opposite side if the preferred one would run
 * off-screen and clamped along the other axis so it always stays inside the viewport. The
 * arrow keeps pointing at the trigger through all of that.
 *
 * Without this, a `side="top"` tooltip on anything in a page header (which sits at y≈0)
 * rendered above the top edge of the window and was simply invisible.
 */
export const Tooltip: Component<TooltipProps> = (props) => {
  const [show, setShow] = createSignal(false);
  const [placement, setPlacement] = createSignal<Placement | null>(null);
  let triggerEl: HTMLElement | undefined;
  let bubbleEl: HTMLDivElement | undefined;

  function place() {
    if (!triggerEl || !bubbleEl) return;
    const r = triggerEl.getBoundingClientRect();
    const w = bubbleEl.offsetWidth;
    const h = bubbleEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let side: Side = props.side ?? 'right';

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

  const onReflow = () => place();

  function open() {
    setPlacement(null);
    setShow(true);
    // The bubble has to exist before it can be measured; Solid inserts it synchronously,
    // so one frame is enough for fonts/layout to settle.
    requestAnimationFrame(place);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
  }

  function stopListening() {
    window.removeEventListener('resize', onReflow);
    window.removeEventListener('scroll', onReflow, true);
  }

  function close() {
    setShow(false);
    setPlacement(null);
    stopListening();
  }

  onCleanup(stopListening);

  return (
    <div
      ref={(el) => {
        triggerEl = el;
      }}
      class={props.inline ? 'inline-flex' : 'w-full flex justify-center'}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {props.children}
      <Show when={show()}>
        <Portal>
          <div
            ref={(el) => {
              bubbleEl = el;
            }}
            role="tooltip"
            class={`pointer-events-none fixed ${zLayer.popover}`}
            style={{
              top: `${placement()?.top ?? 0}px`,
              left: `${placement()?.left ?? 0}px`,
              // Measured before it is shown, so it never flashes at the wrong spot.
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
              {props.label}
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
