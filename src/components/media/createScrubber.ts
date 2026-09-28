import { createSignal } from 'solid-js';
import { clamp01 } from './format';

/**
 * Pointer + keyboard handling shared by every seek surface (the video seek bar, the audio
 * waveform, the volume slider). Reports a 0..1 fraction; the caller maps it to seconds
 * or volume. Dragging scrubs continuously and is captured, so it keeps working when the
 * pointer leaves the bar.
 */
export interface Scrubber {
  /** Fraction under the pointer while hovering (null when not hovering). */
  hover: () => number | null;
  /** Fraction being dragged to (null when not dragging). */
  dragging: () => number | null;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerLeave: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

export function createScrubber(opts: {
  /** Commit a fraction (pointer release, click, or keyboard step). */
  onCommit: (fraction: number) => void;
  /** Called continuously while dragging (optional live preview). */
  onScrub?: (fraction: number) => void;
  /** Current fraction, for keyboard stepping. */
  value: () => number;
  /** Keyboard step as a fraction of the whole (default 5%). */
  step?: number;
  rtl?: () => boolean;
}): Scrubber {
  const [hover, setHover] = createSignal<number | null>(null);
  const [dragging, setDragging] = createSignal<number | null>(null);

  function fractionAt(e: PointerEvent): number {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    let f = clamp01((e.clientX - rect.left) / rect.width);
    if (opts.rtl?.()) f = 1 - f;
    return f;
  }

  return {
    hover,
    dragging,
    onPointerDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const f = fractionAt(e);
      setDragging(f);
      opts.onScrub?.(f);
    },
    onPointerMove(e) {
      const f = fractionAt(e);
      if (dragging() !== null) {
        setDragging(f);
        opts.onScrub?.(f);
      }
      setHover(f);
    },
    onPointerUp(e) {
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (dragging() === null) return;
      const f = fractionAt(e);
      setDragging(null);
      opts.onCommit(f);
    },
    onPointerLeave() {
      setHover(null);
    },
    onKeyDown(e) {
      const step = opts.step ?? 0.05;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = clamp01(opts.value() + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = clamp01(opts.value() - step);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
      opts.onCommit(next);
    },
  };
}
