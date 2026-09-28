/**
 * Accessibility preferences that don't belong to the theme: colour saturation, link
 * underlining and following the OS reduced-motion setting. Reduced motion, text size and
 * transparency themselves live in the appearance store; the Accessibility page mirrors
 * those controls.
 */

import { createEffect, createRoot, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { appearance, setReduceMotion } from './appearance';

const STORAGE_KEY = 'strafe_accessibility';
const STYLE_ID = 'strafe-accessibility';

export interface AccessibilityState {
  /** 0..100, 100 = untouched colours. */
  saturation: number;
  underlineLinks: boolean;
  /** Mirror `prefers-reduced-motion` into the reduce-motion setting. */
  followSystemMotion: boolean;
}

const DEFAULTS: AccessibilityState = { saturation: 100, underlineLinks: false, followSystemMotion: false };

function load(): AccessibilityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AccessibilityState>;
      return {
        saturation: typeof p.saturation === 'number' ? Math.min(100, Math.max(0, Math.round(p.saturation))) : DEFAULTS.saturation,
        underlineLinks: p.underlineLinks ?? DEFAULTS.underlineLinks,
        followSystemMotion: p.followSystemMotion ?? DEFAULTS.followSystemMotion,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export const [accessibility, setAccessibilityStore] = createStore<AccessibilityState>(load());

export function setAccessibility(patch: Partial<AccessibilityState>): void {
  setAccessibilityStore(patch);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...accessibility }));
  } catch {
    /* ignore */
  }
}

let initialized = false;

/** Apply the preferences to the document and keep them applied. Call once at boot. */
export function initAccessibility() {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  createRoot(() => {
    createEffect(() => {
      // The filter sits on the app root, not <html>, so fixed overlays keep the viewport
      // as their containing block.
      const sat = accessibility.saturation;
      style!.textContent = sat < 100 ? `#root { filter: saturate(${sat / 100}); }` : '';
      document.documentElement.classList.toggle('underline-links', accessibility.underlineLinks);
    });
    createEffect(() => {
      if (!accessibility.followSystemMotion || !mq) return;
      const apply = () => {
        if (appearance.reduceMotion !== mq.matches) setReduceMotion(mq.matches);
      };
      apply();
      mq.addEventListener('change', apply);
      onCleanup(() => mq.removeEventListener('change', apply));
    });
  });
}

/** Whether the OS currently asks for reduced motion (for the settings page hint). */
export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
