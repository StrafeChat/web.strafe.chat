import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_settings';

function loadSettings(): { messageCompact: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { messageCompact?: boolean };
      return { messageCompact: parsed.messageCompact ?? false };
    }
  } catch {
    // ignore
  }
  return { messageCompact: false };
}

export const [settings, setSettings] = createStore(loadSettings());

export function setMessageCompact(compact: boolean) {
  setSettings('messageCompact', compact);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    current.messageCompact = compact;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}
