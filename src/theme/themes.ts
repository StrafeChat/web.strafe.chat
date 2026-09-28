/**
 * Theme model. A theme is a named set of hex colors for every design token the app's
 * Tailwind utilities read through `var(--color-*)`. Applying one simply sets those custom
 * properties on <html>, so it restyles everything without touching component code.
 */

export type ThemeTokenKey =
  | 'background'
  | 'foreground'
  | 'card'
  | 'cardForeground'
  | 'popover'
  | 'popoverForeground'
  | 'primary'
  | 'primaryForeground'
  | 'primaryHover'
  | 'secondary'
  | 'secondaryForeground'
  | 'muted'
  | 'mutedForeground'
  | 'accent'
  | 'accentForeground'
  | 'destructive'
  | 'destructiveForeground'
  | 'border'
  | 'input'
  | 'ring';

export type ThemeTokenGroup = 'Surfaces' | 'Text' | 'Brand' | 'Controls' | 'Feedback';

export interface ThemeTokenDef {
  key: ThemeTokenKey;
  cssVar: string;
  label: string;
  hint: string;
  group: ThemeTokenGroup;
}

export const THEME_TOKENS: ThemeTokenDef[] = [
  { key: 'background', cssVar: '--color-background', label: 'Background', hint: 'Page canvas behind everything', group: 'Surfaces' },
  { key: 'card', cssVar: '--color-card', label: 'Card', hint: 'Sidebars, headers, dialogs', group: 'Surfaces' },
  { key: 'popover', cssVar: '--color-popover', label: 'Popover', hint: 'Menus and profile cards', group: 'Surfaces' },
  { key: 'muted', cssVar: '--color-muted', label: 'Muted', hint: 'Subtle fills (avatars, chips)', group: 'Surfaces' },
  { key: 'secondary', cssVar: '--color-secondary', label: 'Secondary', hint: 'Secondary buttons', group: 'Surfaces' },
  { key: 'accent', cssVar: '--color-accent', label: 'Hover', hint: 'Hover fill on rows and buttons', group: 'Surfaces' },

  { key: 'foreground', cssVar: '--color-foreground', label: 'Text', hint: 'Primary text', group: 'Text' },
  { key: 'mutedForeground', cssVar: '--color-muted-foreground', label: 'Muted text', hint: 'Timestamps, labels, message bodies', group: 'Text' },
  { key: 'cardForeground', cssVar: '--color-card-foreground', label: 'Card text', hint: 'Text on cards', group: 'Text' },
  { key: 'popoverForeground', cssVar: '--color-popover-foreground', label: 'Popover text', hint: 'Text in menus', group: 'Text' },
  { key: 'secondaryForeground', cssVar: '--color-secondary-foreground', label: 'Secondary text', hint: 'Text on secondary buttons', group: 'Text' },
  { key: 'accentForeground', cssVar: '--color-accent-foreground', label: 'Hover text', hint: 'Text on hovered rows', group: 'Text' },

  { key: 'primary', cssVar: '--color-primary', label: 'Brand', hint: 'Buttons, links, mentions, online dot', group: 'Brand' },
  { key: 'primaryHover', cssVar: '--color-primary-hover', label: 'Brand hover', hint: 'Buttons while hovered', group: 'Brand' },
  { key: 'primaryForeground', cssVar: '--color-primary-foreground', label: 'Brand text', hint: 'Text on brand buttons', group: 'Brand' },
  { key: 'ring', cssVar: '--color-ring', label: 'Focus ring', hint: 'Keyboard focus outline', group: 'Brand' },

  { key: 'border', cssVar: '--color-border', label: 'Border', hint: 'Dividers and outlines', group: 'Controls' },
  { key: 'input', cssVar: '--color-input', label: 'Input border', hint: 'Text field outlines', group: 'Controls' },

  { key: 'destructive', cssVar: '--color-destructive', label: 'Danger', hint: 'Delete, errors, mention badge', group: 'Feedback' },
  { key: 'destructiveForeground', cssVar: '--color-destructive-foreground', label: 'Danger text', hint: 'Text on danger buttons', group: 'Feedback' },
];

export const THEME_TOKEN_GROUPS: ThemeTokenGroup[] = ['Surfaces', 'Text', 'Brand', 'Controls', 'Feedback'];

export type ThemeColors = Record<ThemeTokenKey, string>;

export interface ThemeDefinition {
  id: string;
  name: string;
  /** Drives `color-scheme` (native controls, scrollbars) and light-mode CSS hooks. */
  appearance: 'dark' | 'light';
  colors: ThemeColors;
  /** Built-in themes are read-only; users duplicate them to customize. */
  builtin?: boolean;
  description?: string;
}

const STRAFE_DARK: ThemeColors = {
  background: '#101114',
  foreground: '#f3f5f7',
  card: '#17191c',
  cardForeground: '#f3f5f7',
  popover: '#191b1f',
  popoverForeground: '#f3f5f7',
  primary: '#509b6b',
  primaryForeground: '#f5f9f7',
  primaryHover: '#45875d',
  secondary: '#26282c',
  secondaryForeground: '#edf0f2',
  muted: '#26282c',
  mutedForeground: '#aeb6c2',
  accent: '#2e2e2e',
  accentForeground: '#f2f2f2',
  destructive: '#a63030',
  destructiveForeground: '#fafafa',
  border: '#2f3237',
  input: '#26282c',
  ring: '#57a875',
};

const STRAFE_LIGHT: ThemeColors = {
  background: '#f4f6f8',
  foreground: '#1b1f26',
  card: '#ffffff',
  cardForeground: '#1b1f26',
  popover: '#ffffff',
  popoverForeground: '#1b1f26',
  primary: '#3f8a5a',
  primaryForeground: '#ffffff',
  primaryHover: '#35764d',
  secondary: '#e8ecf0',
  secondaryForeground: '#1b1f26',
  muted: '#e8ecf0',
  mutedForeground: '#5b6470',
  accent: '#e1e6ec',
  accentForeground: '#141820',
  destructive: '#c73a3a',
  destructiveForeground: '#ffffff',
  border: '#d6dce3',
  input: '#cfd6de',
  ring: '#3f8a5a',
};

const MIDNIGHT: ThemeColors = {
  ...STRAFE_DARK,
  background: '#0a0b0e',
  card: '#111216',
  popover: '#141519',
  muted: '#1d1f24',
  secondary: '#1d1f24',
  accent: '#23262c',
  border: '#24272d',
  input: '#1d1f24',
  mutedForeground: '#a3abb8',
};

const OCEAN: ThemeColors = {
  background: '#0e1420',
  foreground: '#eef2f8',
  card: '#141b29',
  cardForeground: '#eef2f8',
  popover: '#172033',
  popoverForeground: '#eef2f8',
  primary: '#4f8fd6',
  primaryForeground: '#f5f9ff',
  primaryHover: '#3f78b8',
  secondary: '#1c2536',
  secondaryForeground: '#e6ecf5',
  muted: '#1c2536',
  mutedForeground: '#a8b4c8',
  accent: '#223047',
  accentForeground: '#eef2f8',
  destructive: '#b23a3a',
  destructiveForeground: '#fafafa',
  border: '#24304a',
  input: '#1c2536',
  ring: '#5c9be0',
};

const DUSK: ThemeColors = {
  background: '#14101c',
  foreground: '#f4f0fa',
  card: '#1b1626',
  cardForeground: '#f4f0fa',
  popover: '#1f1a2c',
  popoverForeground: '#f4f0fa',
  primary: '#a273d6',
  primaryForeground: '#fbf8ff',
  primaryHover: '#8c5fc0',
  secondary: '#251f33',
  secondaryForeground: '#ede7f5',
  muted: '#251f33',
  mutedForeground: '#b8aecb',
  accent: '#2c2540',
  accentForeground: '#f4f0fa',
  destructive: '#b23a4a',
  destructiveForeground: '#fafafa',
  border: '#2e2740',
  input: '#251f33',
  ring: '#b088e0',
};

export const BUILTIN_THEMES: ThemeDefinition[] = [
  { id: 'strafe-dark', name: 'Strafe Dark', appearance: 'dark', colors: STRAFE_DARK, builtin: true, description: 'The default look.' },
  { id: 'strafe-light', name: 'Strafe Light', appearance: 'light', colors: STRAFE_LIGHT, builtin: true, description: 'Same sage accent on a bright canvas.' },
  { id: 'midnight', name: 'Midnight', appearance: 'dark', colors: MIDNIGHT, builtin: true, description: 'Deeper blacks for OLED.' },
  { id: 'ocean', name: 'Ocean', appearance: 'dark', colors: OCEAN, builtin: true, description: 'Cool blues.' },
  { id: 'dusk', name: 'Dusk', appearance: 'dark', colors: DUSK, builtin: true, description: 'Warm purples.' },
];

export const DEFAULT_THEME_ID = 'strafe-dark';

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v.trim());
}

/** Expand #abc to #aabbcc, lowercase. */
export function normalizeHex(v: string): string {
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return s;
}

/** Portable JSON shape for sharing themes. */
export interface ThemeExport {
  name: string;
  appearance: 'dark' | 'light';
  colors: Partial<ThemeColors>;
}

export function exportTheme(theme: ThemeDefinition): string {
  const out: ThemeExport = { name: theme.name, appearance: theme.appearance, colors: theme.colors };
  return JSON.stringify(out, null, 2);
}

/**
 * Parse a pasted theme. Missing colors fall back to `base` so a partial theme (just a few
 * overrides) still produces something usable; anything that isn't a hex color is rejected.
 */
export function parseThemeJson(
  json: string,
  base: ThemeColors = STRAFE_DARK
): { ok: true; theme: Omit<ThemeDefinition, 'id'> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Expected a JSON object.' };
  const d = raw as Record<string, unknown>;
  const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 60) : 'Imported theme';
  const appearance = d.appearance === 'light' ? 'light' : 'dark';
  const colorsIn = (d.colors && typeof d.colors === 'object' ? d.colors : {}) as Record<string, unknown>;
  const colors: ThemeColors = { ...base };
  for (const t of THEME_TOKENS) {
    const v = colorsIn[t.key];
    if (v === undefined) continue;
    if (!isHexColor(v)) return { ok: false, error: `"${t.key}" must be a hex color like #1a2b3c.` };
    colors[t.key] = normalizeHex(v);
  }
  return { ok: true, theme: { name, appearance, colors } };
}
