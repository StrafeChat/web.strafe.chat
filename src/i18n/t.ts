import i18next from 'i18next';
import { createSignal } from 'solid-js';
import { I18N_STORAGE_KEY, SUPPORTED_LOCALES, applyDocumentLangDir } from './config';

/**
 * Translation helpers usable from anywhere - components, stores, plain functions.
 *
 * `TransProvider` drives the global i18next instance, so `i18next.t` is always correct;
 * what it lacks is Solid reactivity. Every helper here reads a signal that is bumped on
 * `languageChanged`, so a `t('...')` call inside JSX (or any tracked scope) re-runs when
 * the language changes, with no per-component hook needed.
 */
const [languageTick, setLanguageTick] = createSignal(0);
let bound = false;

/** Call once at startup, before the first render. */
export function bindI18nReactivity(): void {
  if (bound) return;
  bound = true;
  const bump = () => setLanguageTick((n) => n + 1);
  i18next.on('initialized', bump);
  i18next.on('loaded', bump);
  i18next.on('languageChanged', bump);
}

export type TranslateOptions = Record<string, unknown>;

export function t(key: string, options?: TranslateOptions): string {
  languageTick();
  return i18next.t(key, options as never) as unknown as string;
}

/** Current UI language (BCP 47 tag such as `en`, `pt-BR`), reactive. */
export function currentLanguage(): string {
  languageTick();
  return i18next.language || 'en';
}

/** Whether the current UI language lays out right-to-left, reactive. */
export function isRtl(): boolean {
  return i18next.dir(currentLanguage()) === 'rtl';
}

/** Switch the UI language and remember it on this device. */
export async function setLanguage(next: string): Promise<void> {
  if (!SUPPORTED_LOCALES.has(next)) return;
  await i18next.changeLanguage(next);
  try {
    localStorage.setItem(I18N_STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  applyDocumentLangDir(next);
}

/** `Intl`-friendly date formatting in the current language. */
export function formatDate(date: Date | string | number, options: Intl.DateTimeFormatOptions): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(currentLanguage(), options).format(d);
}

/** `Intl`-friendly number formatting in the current language. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLanguage(), options).format(value);
}
