import { t } from '../../i18n';

export type SectionId =
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
  | 'language'
  | 'developers'
  | 'instance'
  | 'desktop'
  | 'activity';

export interface SettingsNavItem {
  id: SectionId;
  /** i18n key of the nav label */
  labelKey: string;
  icon: string;
}

export const ACCOUNT_ITEMS: SettingsNavItem[] = [
  { id: 'account', labelKey: 'settings.sections.account.title', icon: 'fa-user' },
  // Right after the main profile: it is the same profile, set per space.
  { id: 'spaceProfiles', labelKey: 'settings.sections.spaceProfiles.title', icon: 'fa-id-badge' },
  { id: 'security', labelKey: 'settings.sections.security.title', icon: 'fa-lock' },
  { id: 'devices', labelKey: 'settings.sections.devices.title', icon: 'fa-shield-halved' },
  { id: 'authorizedApps', labelKey: 'settings.sections.authorizedApps.title', icon: 'fa-plug' },
];

/**
 * A person's own OAuth2 applications and bots. Available to everyone - the developer
 * platform is not gated - so it sits in its own group after the app preferences.
 */
export const DEVELOPERS_ITEM: SettingsNavItem = {
  id: 'developers',
  labelKey: 'settings.sections.developers.title',
  icon: 'fa-code',
};

/**
 * Shown only to an instance administrator, so it is not part of APP_ITEMS - the modal
 * appends it once the server confirms who is asking.
 */
export const INSTANCE_ITEM: SettingsNavItem = {
  id: 'instance',
  labelKey: 'settings.sections.instance.title',
  icon: 'fa-server',
};

/**
 * Shown only in the desktop app (updates, start-up, the tray), so it is not part of
 * APP_ITEMS - the modal appends it when the shell is there.
 */
export const DESKTOP_ITEM: SettingsNavItem = {
  id: 'desktop',
  labelKey: 'settings.sections.desktop.title',
  icon: 'fa-display',
};

/**
 * Sharing the game you are playing. Only a desktop shell can see what is running, and only
 * one that knows how (gamesAvailable), so it is not part of APP_ITEMS - the modal appends it
 * once the shell says yes.
 */
export const ACTIVITY_ITEM: SettingsNavItem = {
  id: 'activity',
  labelKey: 'settings.sections.activity.title',
  icon: 'fa-gamepad',
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
