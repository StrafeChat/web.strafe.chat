import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_settings';

export type SettingsData = {
  messageCompact: boolean;
  membersPanelOpen: boolean;
  /** Reopen the last visited page when the app starts on "/". */
  restoreLastVisited: boolean;
  /** Browser spellcheck in the message composer. */
  spellcheck: boolean;
};

const DEFAULTS: SettingsData = {
  messageCompact: false,
  membersPanelOpen: false,
  restoreLastVisited: false,
  spellcheck: true,
};

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsData>;
      return {
        messageCompact: parsed.messageCompact ?? DEFAULTS.messageCompact,
        membersPanelOpen: parsed.membersPanelOpen ?? DEFAULTS.membersPanelOpen,
        restoreLastVisited: parsed.restoreLastVisited ?? DEFAULTS.restoreLastVisited,
        spellcheck: parsed.spellcheck ?? DEFAULTS.spellcheck,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
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

export function setRestoreLastVisited(on: boolean) {
  setSettings('restoreLastVisited', on);
  persistSettings({ restoreLastVisited: on });
}

export function setSpellcheck(on: boolean) {
  setSettings('spellcheck', on);
  persistSettings({ spellcheck: on });
}
