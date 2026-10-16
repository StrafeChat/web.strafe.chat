import { createSignal } from 'solid-js';
import type { Space } from '../api/spaces';

/**
 * The order the person has arranged their spaces in, by space id.
 *
 * Persisted to localStorage for now; this is where a per-account `space_order` from the
 * server will slot in later (fetched on READY, written back on drop instead of here). The
 * rail reads it through `orderSpacesByPreference` and writes it through `set`; nothing else
 * depends on how it is stored, so swapping the backing store is one file's work.
 */
const KEY = 'strafe-space-order';

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    // localStorage unavailable (private mode / quota): the order is a convenience, not state.
    return [];
  }
}

const [storedOrder, setStoredOrder] = createSignal<string[]>(readStored());

export const spaceOrder = {
  ids: (): string[] => storedOrder(),
  /** Persist a new order (the full list of visible space ids, in display order). */
  set(ids: string[]) {
    const next = ids.filter((id, i) => id && ids.indexOf(id) === i);
    setStoredOrder(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // ignore: the in-memory order still applies for this session.
    }
  },
  /** Sign-out: the order is of the leaving account's spaces. */
  clear() {
    setStoredOrder([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

/**
 * Apply the stored order to a space list. Spaces with no stored position (joined since the
 * order was last saved, or on a fresh device) keep the server's order after the ranked ones.
 */
export function orderSpacesByPreference(list: Space[]): Space[] {
  const preferred = storedOrder();
  if (preferred.length === 0) return list;
  const rank = new Map<string, number>();
  preferred.forEach((id, i) => rank.set(id, i));
  // Array.sort is stable, so two unranked spaces keep their incoming (server) order.
  return [...list].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
