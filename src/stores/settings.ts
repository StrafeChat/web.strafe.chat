import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_settings';

export type SettingsData = {
  messageCompact: boolean;
  membersPanelOpen: boolean;
};

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      return {
        messageCompact: parsed.messageCompact ?? false,
        membersPanelOpen: parsed.membersPanelOpen ?? false,
      };
    }
  } catch {
    // ignore
  }
  return { messageCompact: false, membersPanelOpen: false };
}

export const [settings, setSettings] = createStore<SettingsData>(loadSettings());

function persistSettings(updates: Partial<SettingsData>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    Object.assign(current, updates);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function setMessageCompact(compact: boolean) {
  setSettings('messageCompact', compact);
  persistSettings({ messageCompact: compact });
}

export function setMembersPanelOpen(open: boolean) {
  setSettings('membersPanelOpen', open);
  persistSettings({ membersPanelOpen: open });
}
