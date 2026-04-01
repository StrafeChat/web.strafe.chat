import { createSignal } from 'solid-js';

const [userSettingsOpen, setUserSettingsOpen] = createSignal(false);

export function openUserSettings() {
  setUserSettingsOpen(true);
}

export function closeUserSettings() {
  setUserSettingsOpen(false);
}

export { userSettingsOpen };
