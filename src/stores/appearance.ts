import { createStore } from 'solid-js/store';
import { createEffect, createRoot } from 'solid-js';
import {
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  THEME_TOKENS,
  isHexColor,
  normalizeHex,
  type ThemeColors,
  type ThemeDefinition,
} from '../theme/themes';
import { DEFAULT_EMOJI_PROVIDER, isEmojiProviderId, type EmojiProviderId } from '../lib/emoji/providers';
import { t } from '../i18n';

export type FontScale = 'sm' | 'md' | 'lg';
export type CornerStyle = 'sharp' | 'soft' | 'round';
export type FontChoice = 'system' | 'inter' | 'outfit';
/** Row spacing across the conversation / channel / member lists, à la Discord's UI Density. */
export type UiDensity = 'compact' | 'default' | 'spacious';

/** Space between message groups, in px. Clamped to this range (Discord's is 0-24). */
export const MESSAGE_GROUP_SPACING_MIN = 0;
export const MESSAGE_GROUP_SPACING_MAX = 24;
export const MESSAGE_GROUP_SPACING_DEFAULT = 16;

export interface AppearanceState {
  themeId: string;
  customThemes: ThemeDefinition[];
  /** Unsaved theme being edited - applied live while the editor is open. Not persisted. */
  previewTheme: ThemeDefinition | null;
  fontScale: FontScale;
  corners: CornerStyle;
  font: FontChoice;
  /** Row spacing of the conversation / channel / member lists. */
  uiDensity: UiDensity;
  /** Gap between message groups, in px (see MESSAGE_GROUP_SPACING_*). */
  messageGroupSpacing: number;
  /** Frosted-glass surfaces (backdrop blur + translucency). Off = flat opaque panels. */
  glass: boolean;
  reduceMotion: boolean;
  customCss: string;
  customCssEnabled: boolean;
  /** Which image set draws Unicode emoji (or 'native' for the OS font). */
  emojiProvider: EmojiProviderId;
  /** Default skin tone applied by the picker: 0 = none, 1..5 light → dark. */
  emojiSkinTone: number;
}

const STORAGE_KEY = 'strafe_appearance';
const CUSTOM_CSS_MAX = 100_000;

const DEFAULTS: AppearanceState = {
  themeId: DEFAULT_THEME_ID,
  customThemes: [],
  previewTheme: null,
  fontScale: 'md',
  corners: 'soft',
  font: 'system',
  uiDensity: 'default',
  messageGroupSpacing: MESSAGE_GROUP_SPACING_DEFAULT,
  glass: true,
  reduceMotion: false,
  customCss: '',
  customCssEnabled: false,
  emojiProvider: DEFAULT_EMOJI_PROVIDER,
  emojiSkinTone: 0,
};

function sanitizeTheme(raw: unknown): ThemeDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== 'string' || !d.id || typeof d.name !== 'string') return null;
  const colorsIn = (d.colors && typeof d.colors === 'object' ? d.colors : {}) as Record<string, unknown>;
  const colors = { ...BUILTIN_THEMES[0]!.colors } as ThemeColors;
  for (const t of THEME_TOKENS) {
    const v = colorsIn[t.key];
    if (isHexColor(v)) colors[t.key] = normalizeHex(v);
  }
  return {
    id: d.id,
    name: d.name.slice(0, 60) || t('settings.appearance.theme.customName'),
    appearance: d.appearance === 'light' ? 'light' : 'dark',
    colors,
  };
}

function load(): AppearanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<AppearanceState>;
    const customThemes = Array.isArray(p.customThemes)
      ? (p.customThemes.map(sanitizeTheme).filter(Boolean) as ThemeDefinition[])
      : [];
    return {
      ...DEFAULTS,
      themeId: typeof p.themeId === 'string' ? p.themeId : DEFAULTS.themeId,
      customThemes,
      fontScale: p.fontScale === 'sm' || p.fontScale === 'lg' ? p.fontScale : 'md',
      corners: p.corners === 'sharp' || p.corners === 'round' ? p.corners : 'soft',
      font: p.font === 'inter' || p.font === 'outfit' ? p.font : 'system',
      uiDensity: p.uiDensity === 'compact' || p.uiDensity === 'spacious' ? p.uiDensity : 'default',
      messageGroupSpacing:
        typeof p.messageGroupSpacing === 'number'
          ? Math.min(MESSAGE_GROUP_SPACING_MAX, Math.max(MESSAGE_GROUP_SPACING_MIN, Math.round(p.messageGroupSpacing)))
          : MESSAGE_GROUP_SPACING_DEFAULT,
      glass: p.glass !== false,
      reduceMotion: p.reduceMotion === true,
      customCss: typeof p.customCss === 'string' ? p.customCss.slice(0, CUSTOM_CSS_MAX) : '',
      customCssEnabled: p.customCssEnabled === true,
      emojiProvider: isEmojiProviderId(p.emojiProvider) ? p.emojiProvider : DEFAULT_EMOJI_PROVIDER,
      emojiSkinTone:
        typeof p.emojiSkinTone === 'number' && p.emojiSkinTone >= 0 && p.emojiSkinTone <= 5 ? Math.floor(p.emojiSkinTone) : 0,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const [appearance, setAppearance] = createStore<AppearanceState>(load());

function persist() {
  try {
    const { previewTheme: _preview, ...rest } = appearance;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    // ignore quota / private mode
  }
}

export const allThemes = (): ThemeDefinition[] => [...BUILTIN_THEMES, ...appearance.customThemes];

export const savedTheme = (): ThemeDefinition =>
  allThemes().find((t) => t.id === appearance.themeId) ?? BUILTIN_THEMES[0]!;

/** What's on screen right now: the live editor preview when open, else the saved pick. */
export const activeTheme = (): ThemeDefinition => appearance.previewTheme ?? savedTheme();

export function setThemeId(id: string) {
  if (!allThemes().some((t) => t.id === id)) return;
  setAppearance('themeId', id);
  persist();
}

export function setPreviewTheme(theme: ThemeDefinition | null) {
  setAppearance('previewTheme', theme);
}

export function newCustomThemeId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Insert or replace a custom theme, then select it. */
export function saveCustomTheme(theme: ThemeDefinition) {
  const clean: ThemeDefinition = {
    id: theme.id,
    name: theme.name.trim().slice(0, 60) || t('settings.appearance.theme.customName'),
    appearance: theme.appearance,
    colors: { ...theme.colors },
  };
  setAppearance('customThemes', (list) => {
    const idx = list.findIndex((t) => t.id === clean.id);
    if (idx >= 0) return list.map((t, i) => (i === idx ? clean : t));
    return [...list, clean];
  });
  setAppearance('themeId', clean.id);
  persist();
}

export function deleteCustomTheme(id: string) {
  setAppearance('customThemes', (list) => list.filter((t) => t.id !== id));
  if (appearance.themeId === id) setAppearance('themeId', DEFAULT_THEME_ID);
  persist();
}

export function setFontScale(v: FontScale) {
  setAppearance('fontScale', v);
  persist();
}
export function setCorners(v: CornerStyle) {
  setAppearance('corners', v);
  persist();
}
export function setFont(v: FontChoice) {
  setAppearance('font', v);
  persist();
}
export function setUiDensity(v: UiDensity) {
  setAppearance('uiDensity', v);
  persist();
}
export function setMessageGroupSpacing(v: number) {
  setAppearance(
    'messageGroupSpacing',
    Math.min(MESSAGE_GROUP_SPACING_MAX, Math.max(MESSAGE_GROUP_SPACING_MIN, Math.round(v)))
  );
  persist();
}
export function setGlass(v: boolean) {
  setAppearance('glass', v);
  persist();
}
export function setReduceMotion(v: boolean) {
  setAppearance('reduceMotion', v);
  persist();
}
export function setEmojiProvider(v: EmojiProviderId) {
  setAppearance('emojiProvider', v);
  persist();
}
export function setEmojiSkinTone(v: number) {
  setAppearance('emojiSkinTone', Math.max(0, Math.min(5, Math.floor(v))));
  persist();
}
export function setCustomCss(css: string) {
  setAppearance('customCss', css.slice(0, CUSTOM_CSS_MAX));
  persist();
}
export function setCustomCssEnabled(v: boolean) {
  setAppearance('customCssEnabled', v);
  persist();
}

const FONT_STACKS: Record<FontChoice, string> = {
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  outfit: "'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const FONT_SIZES: Record<FontScale, string> = { sm: '93.75%', md: '', lg: '106.25%' };

/** Radius scale per corner style; `soft` restores the stylesheet defaults. */
const RADII: Record<CornerStyle, Record<string, string> | null> = {
  soft: null,
  sharp: {
    '--radius-sm': '4px',
    '--radius-md': '6px',
    '--radius-lg': '8px',
    '--radius-xl': '10px',
    '--radius-2xl': '12px',
    '--radius-3xl': '16px',
  },
  round: {
    '--radius-sm': '0.75rem',
    '--radius-md': '0.875rem',
    '--radius-lg': '1.125rem',
    '--radius-xl': '1.5rem',
    '--radius-2xl': '1.75rem',
    '--radius-3xl': '2.25rem',
  },
};
const RADIUS_VARS = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-3xl'];

const THEME_STYLE_ID = 'strafe-theme';
const CUSTOM_CSS_STYLE_ID = 'strafe-custom-css';

/**
 * Both blocks are ordinary <style> elements appended to <head> in this order, so:
 *  - they come after the app stylesheet and win over its `:root` token defaults, and
 *  - the user's custom CSS comes after the theme block and can override any token with a
 *    plain `:root { --color-primary: … }` (an inline style on <html> would have beaten it).
 */
function styleEl(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function applyThemeStyles(
  theme: ThemeDefinition,
  s: Pick<AppearanceState, 'fontScale' | 'corners' | 'font' | 'glass' | 'reduceMotion' | 'uiDensity' | 'messageGroupSpacing'>
) {
  const root = document.documentElement;
  const vars: string[] = [`color-scheme: ${theme.appearance};`];
  for (const t of THEME_TOKENS) vars.push(`${t.cssVar}: ${theme.colors[t.key]};`);
  vars.push(`--font-sans: ${FONT_STACKS[s.font]};`);
  const radii = RADII[s.corners];
  if (radii) for (const v of RADIUS_VARS) vars.push(`${v}: ${radii[v]};`);
  const spacing = Math.min(MESSAGE_GROUP_SPACING_MAX, Math.max(MESSAGE_GROUP_SPACING_MIN, Math.round(s.messageGroupSpacing)));
  vars.push(`--space-message-group: ${spacing}px;`);
  const fontSize = FONT_SIZES[s.fontScale];
  styleEl(THEME_STYLE_ID).textContent =
    `:root {\n  ${vars.join('\n  ')}\n}\n` + (fontSize ? `html { font-size: ${fontSize}; }\n` : '');
  root.dataset.theme = theme.appearance;
  // 'default' leaves data-density absent, so the bare :root density vars apply.
  if (s.uiDensity === 'default') delete root.dataset.density;
  else root.dataset.density = s.uiDensity;
  root.classList.toggle('no-glass', !s.glass);
  root.classList.toggle('reduce-motion', s.reduceMotion);
}

function applyCustomCss(css: string, enabled: boolean) {
  styleEl(CUSTOM_CSS_STYLE_ID).textContent = enabled ? css : '';
}

let initialized = false;

/** Start applying appearance settings to the document. Safe to call once at app boot. */
export function initAppearance() {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  // Create in cascade order before any effect runs (see styleEl comment).
  styleEl(THEME_STYLE_ID);
  styleEl(CUSTOM_CSS_STYLE_ID);
  createRoot(() => {
    createEffect(() =>
      applyThemeStyles(activeTheme(), {
        fontScale: appearance.fontScale,
        corners: appearance.corners,
        font: appearance.font,
        glass: appearance.glass,
        reduceMotion: appearance.reduceMotion,
        uiDensity: appearance.uiDensity,
        messageGroupSpacing: appearance.messageGroupSpacing,
      })
    );
    createEffect(() => applyCustomCss(appearance.customCss, appearance.customCssEnabled));
  });
}
