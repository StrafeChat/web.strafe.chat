/**
 * Scroll anchoring for the message list: keep what the viewer is looking at fixed on screen
 * while content changes above it - a page of older history prepending, the top skeleton
 * coming or going, far-off rows being trimmed. Capture before the change and restore right
 * after, in the same task, so the adjustment lands before the next paint.
 *
 * Anchored on a row rather than on scrollHeight so it stays correct when things change on
 * both sides of the viewport at once (older rows added above while the far tail is dropped
 * below), and so it is idempotent with the browser's own scroll anchoring: when Chrome has
 * already kept the row in place, the measured delta is simply zero.
 */
export interface ScrollAnchor {
  /** Top-most row with any part on screen, and where its top edge sat relative to the viewport. */
  id: string | null;
  top: number;
  scrollTop: number;
  scrollHeight: number;
}

/** The top-most row with any part on screen - rows are in document order, so a binary search. */
function topVisibleRow(container: HTMLElement): HTMLElement | null {
  const rows = container.querySelectorAll<HTMLElement>('[data-msg-id]');
  const viewTop = container.getBoundingClientRect().top;
  let lo = 0;
  let hi = rows.length - 1;
  let found: HTMLElement | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid]!;
    if (row.getBoundingClientRect().bottom > viewTop) {
      found = row;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return found;
}

export function captureScrollAnchor(container: HTMLElement): ScrollAnchor {
  const row = topVisibleRow(container);
  return {
    id: row?.getAttribute('data-msg-id') ?? null,
    top: row ? row.getBoundingClientRect().top - container.getBoundingClientRect().top : 0,
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
  };
}

/** Put the anchored row back where it was. Falls back to the scrollHeight delta when the row is gone. */
export function restoreScrollAnchor(container: HTMLElement, anchor: ScrollAnchor): void {
  if (anchor.id) {
    const row = container.querySelector<HTMLElement>(`[data-msg-id="${anchor.id}"]`);
    if (row) {
      const delta = row.getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) >= 0.5) container.scrollTop += delta;
      return;
    }
  }
  const grown = container.scrollHeight - anchor.scrollHeight;
  if (grown !== 0) container.scrollTop = anchor.scrollTop + grown;
}

/** True when the row for `id` lies entirely below the viewport by at least `margin` px. */
export function rowIsBelowViewport(container: HTMLElement, id: string, margin: number): boolean {
  const row = container.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
  if (!row) return false;
  return row.getBoundingClientRect().top > container.getBoundingClientRect().bottom + margin;
}

/** True when the row for `id` lies entirely above the viewport by at least `margin` px. */
export function rowIsAboveViewport(container: HTMLElement, id: string, margin: number): boolean {
  const row = container.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
  if (!row) return false;
  return row.getBoundingClientRect().bottom < container.getBoundingClientRect().top - margin;
}
