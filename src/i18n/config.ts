export const I18N_STORAGE_KEY = 'strafe_i18n_language';

export const LOCALES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const SUPPORTED_LOCALES = new Set<string>(LOCALES.map((l) => l.code));

/** Locales that use right-to-left layout */
export const RTL_LOCALES = new Set<string>(['ar']);

export function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(I18N_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.has(stored)) return stored;
  } catch {
    /* private mode */
  }
  if (typeof navigator !== 'undefined') {
    const short = navigator.language?.slice(0, 2).toLowerCase();
    if (short && SUPPORTED_LOCALES.has(short)) return short;
  }
  return 'en';
}

export function applyDocumentLangDir(lng: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', lng);
  root.setAttribute('dir', RTL_LOCALES.has(lng) ? 'rtl' : 'ltr');
}
