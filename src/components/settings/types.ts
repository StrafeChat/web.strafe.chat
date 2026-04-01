export type SectionId = 'account' | 'appearance';

export interface SettingsNavItem {
  id: SectionId;
  label: string;
  icon: string;
}

export const ACCOUNT_ITEMS: SettingsNavItem[] = [
  { id: 'account', label: 'Profile', icon: 'fa-user' },
];

export const APP_ITEMS: SettingsNavItem[] = [
  { id: 'appearance', label: 'Look & Feel', icon: 'fa-palette' },
];

export const SECTION_TITLES: Record<SectionId, string> = {
  account: 'Profile',
  appearance: 'Look & Feel',
};

export function formatDiscriminator(d: number): string {
  return String(d).padStart(4, '0');
}
