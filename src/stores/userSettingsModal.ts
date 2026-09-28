import { createSignal } from 'solid-js';

/** Matches `SectionId` in settings — avoid importing components from stores */
export type UserSettingsSection =
  | 'account'
  | 'devices'
  | 'appearance'
  | 'accessibility'
  | 'voice'
  | 'notifications'
  | 'keybinds'
  | 'language';

const [userSettingsOpen, setUserSettingsOpen] = createSignal(false);

let pendingSection: UserSettingsSection | null = null;

export function openUserSettings(section?: UserSettingsSection) {
  pendingSection = section ?? null;
  setUserSettingsOpen(true);
}

export function closeUserSettings() {
  setUserSettingsOpen(false);
}

/** Called when modal opens; returns requested section or null (keep default). */
export function takePendingSettingsSection(): UserSettingsSection | null {
  const s = pendingSection;
  pendingSection = null;
  return s;
}

export { userSettingsOpen };
