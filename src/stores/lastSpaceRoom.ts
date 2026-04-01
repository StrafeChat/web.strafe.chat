import { createSignal } from 'solid-js';

const KEY = 'strafe-last-space-room';

function getInitial(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string' && v) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

const [map, setMap] = createSignal<Record<string, string>>(getInitial());

export const lastSpaceRoom = {
  get(spaceId: string): string | undefined {
    return map()[spaceId];
  },
  set(spaceId: string, roomId: string) {
    if (!spaceId || !roomId) return;
    setMap((prev) => {
      const next = { ...prev, [spaceId]: roomId };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  },
};

