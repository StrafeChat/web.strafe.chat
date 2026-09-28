import { onCleanup, onMount } from 'solid-js';

/**
 * Open dialogs, bottom-most first. Escape only ever closes the top-most one, so a confirm
 * raised from inside settings doesn't also close settings.
 */
const openDialogs: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true'
  );
}

export interface DialogBehaviorOptions {
  /** Requested by Escape (the caller decides whether it actually closes). */
  onClose: () => void;
  /** When it returns false, Escape is ignored (e.g. while saving). */
  dismissible?: () => boolean;
  /** The dialog panel: receives initial focus and traps Tab. */
  panel: () => HTMLElement | undefined;
}

/**
 * Shared keyboard + focus behaviour for anything modal: Escape closes the top-most dialog,
 * Tab cycles inside the panel, focus lands in the panel on open (on an `autofocus` /
 * `data-autofocus` element when there is one) and returns to the opener on close.
 *
 * Call from a component that is mounted only while the dialog is open. Attach the returned
 * `onKeyDown` to the panel element.
 */
export function createDialogBehavior(opts: DialogBehaviorOptions): { onKeyDown: (e: KeyboardEvent) => void } {
  const token = Symbol('dialog');
  const opener = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  onMount(() => {
    openDialogs.push(token);

    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (openDialogs[openDialogs.length - 1] !== token) return;
      if (opts.dismissible && !opts.dismissible()) return;
      e.preventDefault();
      opts.onClose();
    };
    window.addEventListener('keydown', onEscape);

    // Wait a frame so the browser's own `autofocus` handling has had its chance first.
    const raf = requestAnimationFrame(() => {
      const panel = opts.panel();
      if (!panel || panel.contains(document.activeElement)) return;
      const target = panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? panel;
      target.focus({ preventScroll: true });
    });

    onCleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onEscape);
      const i = openDialogs.lastIndexOf(token);
      if (i >= 0) openDialogs.splice(i, 1);
      // Only hand focus back when it is about to be lost (body or the closing panel); if
      // another dialog already took it, leave it there.
      const active = document.activeElement;
      const panel = opts.panel();
      const losingFocus = !active || active === document.body || (panel ? panel.contains(active) : false);
      if (losingFocus && opener && opener.isConnected) opener.focus({ preventScroll: true });
    });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = opts.panel();
    if (!panel) return;
    const items = focusableIn(panel);
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || active === panel || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || active === panel) {
      e.preventDefault();
      first.focus();
    }
  };

  return { onKeyDown };
}

const EXIT_MS = 220;

/**
 * Fade a dialog out when its component unmounts. Callers unmount dialogs through
 * `<Show>`, so there is no hook to delay removal; instead a static snapshot of the overlay
 * (a deep clone - inputs keep their values per the HTML cloning steps) is appended to
 * `<body>`, played backwards and dropped. It is inert, so it can't be clicked or focused.
 */
export function createDialogExit(getOverlay: () => HTMLElement | undefined): void {
  onCleanup(() => {
    const overlay = getOverlay();
    if (!overlay || typeof document === 'undefined') return;
    const ghost = overlay.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-modal');
    ghost.removeAttribute('data-settings-backdrop');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.style.pointerEvents = 'none';
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    ghost.querySelectorAll('[role="dialog"]').forEach((el) => {
      el.removeAttribute('role');
      el.classList.remove('dialog-panel-in', 'dialog-sheet');
      el.classList.add('dialog-panel-out');
    });
    ghost.classList.remove('dialog-overlay-in');
    ghost.classList.add('dialog-overlay-out');
    document.body.appendChild(ghost);
    window.setTimeout(() => ghost.remove(), EXIT_MS);
  });
}
