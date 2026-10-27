import { createSignal } from 'solid-js';

/** Matches `SectionId` in settings — avoid importing components from stores */
export type UserSettingsSection =
  | 'instance'
  | 'account'
  | 'spaceProfiles'
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
/** The space "Edit Space Profile" was opened from, so Space Profiles starts on it. */
let pendingSpaceProfileSpaceId: string | null = null;

export function openUserSettings(section?: UserSettingsSection, opts?: { spaceId?: string }) {
  pendingSection = section ?? null;
  pendingSpaceProfileSpaceId = opts?.spaceId ?? null;
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

/** The space Space Profiles should open on, consumed on read; null = the page's own default
 * (the active space, else the first). */
export function takePendingSpaceProfileSpaceId(): string | null {
  const s = pendingSpaceProfileSpaceId;
  pendingSpaceProfileSpaceId = null;
  return s;
}

export { userSettingsOpen };
