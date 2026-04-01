import { createSignal } from 'solid-js';

/** Below md: whether the narrow rails + peek are shown, or main content is full-screen */
export type MobileNavFocus = 'rails' | 'content';

export const [isMdViewport, setIsMdViewport] = createSignal(
  typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
);

export const [mobileNavFocus, setMobileNavFocus] = createSignal<MobileNavFocus>('rails');

export function openMobileRails() {
  setMobileNavFocus('rails');
}

export function openMobileContent() {
  setMobileNavFocus('content');
}
