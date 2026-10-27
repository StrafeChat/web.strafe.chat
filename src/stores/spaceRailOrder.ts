import { createSignal } from 'solid-js';

const KEY = 'strafe-space-rail-order';

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

const [storedOrder, setStoredOrder] = createSignal<string[]>(readStored());

export const spaceRailOrder = {
  ids: (): string[] => storedOrder(),
  set(ids: string[]) {
    const next = ids.filter((id, i) => id && ids.indexOf(id) === i);
    setStoredOrder(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return;
    }
  },
  clear() {
    setStoredOrder([]);
    try {
      localStorage.removeItem(KEY);
    } catch {
      return;
    }
  },
};
