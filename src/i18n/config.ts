export const I18N_STORAGE_KEY = 'strafe_i18n_language';

/**
 * Languages the UI ships with. `label` is the language's own name (what a speaker
 * expects to find in a list); `englishLabel` helps someone who landed in the wrong
 * language find their way back.
 */
export const LOCALES = [
  { code: 'en', label: 'English', englishLabel: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', englishLabel: 'Spanish', flag: '🇪🇸' },
  { code: 'pt-BR', label: 'Português (Brasil)', englishLabel: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', englishLabel: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', englishLabel: 'German', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', englishLabel: 'Arabic', flag: '🇸🇦' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const SUPPORTED_LOCALES = new Set<string>(LOCALES.map((l) => l.code));

/** Locales that use right-to-left layout */
export const RTL_LOCALES = new Set<string>(['ar']);

/**
 * Best supported locale for a BCP 47 tag: an exact match first (`pt-BR`), then the same
 * base language (`pt-PT` and `pt` both land on `pt-BR`, `en-GB` on `en`).
 */
export function matchSupportedLocale(tag: string | undefined | null): string | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  for (const l of LOCALES) if (l.code.toLowerCase() === lower) return l.code;
  const base = lower.split('-')[0];
  for (const l of LOCALES) if (l.code.toLowerCase().split('-')[0] === base) return l.code;
  return null;
}

export function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(I18N_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.has(stored)) return stored;
  } catch {
    /* private mode */
  }
  if (typeof navigator !== 'undefined') {
    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of candidates) {
      const match = matchSupportedLocale(tag);
      if (match) return match;
    }
  }
  return 'en';
}

export function applyDocumentLangDir(lng: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('lang', lng);
  root.setAttribute('dir', RTL_LOCALES.has(lng) ? 'rtl' : 'ltr');
}
