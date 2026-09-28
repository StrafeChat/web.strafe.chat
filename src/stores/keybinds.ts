/**
 * Configurable keyboard shortcuts. A combo is stored as "Ctrl+Shift+K": modifiers in the
 * fixed order Ctrl, Alt, Shift, Meta, then the key (`KeyboardEvent.key`, letters upper
 * case). On macOS ⌘ is treated as Ctrl so one binding works on every platform.
 */

import { createStore } from 'solid-js/store';

const STORAGE_KEY = 'strafe_keybinds';

export type KeybindAction =
  | 'openSettings'
  | 'toggleMembers'
  | 'focusSearch'
  | 'markSpaceRead'
  | 'prevRoom'
  | 'nextRoom'
  | 'toggleCompact'
  | 'toggleMute'
  | 'toggleDeafen'
  | 'disconnectVoice';

export const KEYBIND_ACTIONS: KeybindAction[] = [
  'openSettings',
  'toggleMembers',
  'focusSearch',
  'markSpaceRead',
  'prevRoom',
  'nextRoom',
  'toggleCompact',
  'toggleMute',
  'toggleDeafen',
  'disconnectVoice',
];

/** Mute / deafen use Discord's combos so people switching over keep their muscle memory;
 * compact mode moved off Ctrl+Shift+M for them. */
export const DEFAULT_KEYBINDS: Record<KeybindAction, string> = {
  openSettings: 'Ctrl+,',
  toggleMembers: 'Ctrl+U',
  focusSearch: 'Ctrl+F',
  markSpaceRead: 'Shift+Escape',
  prevRoom: 'Alt+ArrowUp',
  nextRoom: 'Alt+ArrowDown',
  toggleCompact: 'Alt+Shift+C',
  toggleMute: 'Ctrl+Shift+M',
  toggleDeafen: 'Ctrl+Shift+D',
  disconnectVoice: '',
};

/** Built-in shortcuts that aren't rebindable (listed on the settings page for reference). */
export const FIXED_SHORTCUTS: { id: string; combo: string }[] = [
  { id: 'typeToChat', combo: '' },
  { id: 'editLast', combo: 'ArrowUp' },
  { id: 'newline', combo: 'Shift+Enter' },
  { id: 'closeDialog', combo: 'Escape' },
  { id: 'deleteNoConfirm', combo: 'Shift+Click' },
  { id: 'pushToTalk', combo: '' },
];

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'OS', 'AltGraph']);

function load(): Record<KeybindAction, string> {
  const out = { ...DEFAULT_KEYBINDS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Record<KeybindAction, string>>;
      for (const a of KEYBIND_ACTIONS) if (typeof p[a] === 'string') out[a] = p[a]!;
    }
  } catch {
    /* ignore */
  }
  return out;
}

export const [keybinds, setKeybindsStore] = createStore<Record<KeybindAction, string>>(load());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...keybinds }));
  } catch {
    /* ignore */
  }
}

/** Empty combo = unbound. */
export function setKeybind(action: KeybindAction, combo: string): void {
  setKeybindsStore(action, combo);
  persist();
}

export function resetKeybind(action: KeybindAction): void {
  setKeybind(action, DEFAULT_KEYBINDS[action]);
}

export function resetAllKeybinds(): void {
  setKeybindsStore({ ...DEFAULT_KEYBINDS });
  persist();
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Normalised combo for a keydown, or null while only modifiers are held. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || (isMac && e.metaKey)) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey && !isMac) parts.push('Meta');
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join('+');
}

/** Whether a combo needs a non-Shift modifier (so it is safe to fire inside text fields). */
export function hasStrongModifier(combo: string): boolean {
  return /(^|\+)(Ctrl|Alt|Meta)\+/.test(combo);
}

/** Display form: ["Ctrl", "Shift", "K"] with platform glyphs. */
export function comboParts(combo: string): string[] {
  if (!combo) return [];
  return combo.split('+').map((p) => {
    if (p === 'Ctrl') return isMac ? '⌘' : 'Ctrl';
    if (p === 'Alt') return isMac ? '⌥' : 'Alt';
    if (p === 'Shift') return isMac ? '⇧' : 'Shift';
    if (p === 'Meta') return 'Win';
    if (p === 'ArrowUp') return '↑';
    if (p === 'ArrowDown') return '↓';
    if (p === 'ArrowLeft') return '←';
    if (p === 'ArrowRight') return '→';
    if (p === 'Escape') return 'Esc';
    return p;
  });
}

function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

/**
 * Global dispatcher. Ignores repeats, events already handled, and combos without a
 * strong modifier while typing. Returns a disposer.
 */
export function initKeybinds(handlers: Partial<Record<KeybindAction, () => void>>): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat) return;
    const combo = comboFromEvent(e);
    if (!combo) return;
    const action = KEYBIND_ACTIONS.find((a) => keybinds[a] && keybinds[a] === combo);
    if (!action) return;
    if (inTextField(e.target) && !hasStrongModifier(combo) && !combo.endsWith('Escape')) return;
    // Only the settings shortcut makes sense while a dialog is open.
    if (action !== 'openSettings' && document.querySelector('[role="dialog"]')) return;
    const fn = handlers[action];
    if (!fn) return;
    e.preventDefault();
    fn();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
