import { t } from '../../i18n';

export type SectionId =
  | 'account'
  | 'devices'
  | 'appearance'
  | 'accessibility'
  | 'voice'
  | 'notifications'
  | 'keybinds'
  | 'language'
  | 'instance';

export interface SettingsNavItem {
  id: SectionId;
  /** i18n key of the nav label */
  labelKey: string;
  icon: string;
}

export const ACCOUNT_ITEMS: SettingsNavItem[] = [
  { id: 'account', labelKey: 'settings.sections.account.title', icon: 'fa-user' },
  { id: 'devices', labelKey: 'settings.sections.devices.title', icon: 'fa-shield-halved' },
];

/**
 * Shown only to an instance administrator, so it is not part of APP_ITEMS - the modal
 * appends it once the server confirms who is asking.
 */
export const INSTANCE_ITEM: SettingsNavItem = {
  id: 'instance',
  labelKey: 'settings.sections.instance.title',
  icon: 'fa-server',
};

export const APP_ITEMS: SettingsNavItem[] = [
  { id: 'appearance', labelKey: 'settings.sections.appearance.title', icon: 'fa-palette' },
  { id: 'accessibility', labelKey: 'settings.sections.accessibility.title', icon: 'fa-universal-access' },
  { id: 'voice', labelKey: 'settings.sections.voice.title', icon: 'fa-microphone' },
  { id: 'notifications', labelKey: 'settings.sections.notifications.title', icon: 'fa-bell' },
  { id: 'keybinds', labelKey: 'settings.sections.keybinds.title', icon: 'fa-keyboard' },
  { id: 'language', labelKey: 'settings.sections.language.title', icon: 'fa-language' },
];

export function sectionTitle(id: SectionId): string {
  return t(`settings.sections.${id}.title`);
}

export function sectionDescription(id: SectionId): string {
  return t(`settings.sections.${id}.description`);
}

export function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}
