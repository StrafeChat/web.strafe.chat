import { createSignal } from 'solid-js';

/** Matches `SectionId` in settings — avoid importing components from stores */
export type UserSettingsSection =
  | 'instance'
  | 'account'
  | 'security'
  | 'devices'
  | 'authorizedApps'
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
/** Whether a section was asked for, without consuming it - read at render time by the
 * shell to decide which half a phone starts on. */
export function hasPendingSettingsSection(): boolean {
  return pendingSection !== null;
}

export function takePendingSettingsSection(): UserSettingsSection | null {
  const s = pendingSection;
  pendingSection = null;
  return s;
}

export { userSettingsOpen };
