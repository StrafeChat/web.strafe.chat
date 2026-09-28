import { createSignal } from 'solid-js';

/**
 * Mobile shell state.
 *
 * Below `md` the app is a horizontal pager the way Discord's mobile app is: the nav panel
 * (space rail + room list) and the open room sit side by side, each one viewport wide, and
 * you swipe between them. Both panels stay mounted - that is what lets the swipe track the
 * finger instead of snapping.
 */
export type MobilePanel = 'nav' | 'content';

/** Bottom tab bar destinations. Only meaningful on the nav panel. */
export type MobileTab = 'home' | 'notifications' | 'you';

export const [isMdViewport, setIsMdViewport] = createSignal(
  typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
);

export const [mobilePanel, setMobilePanel] = createSignal<MobilePanel>('nav');
export const [mobileTab, setMobileTab] = createSignal<MobileTab>('home');

/** Live finger delta in px while a swipe is in progress; 0 when settled. */
export const [swipeOffset, setSwipeOffset] = createSignal(0);
/** True only while a finger is actually dragging the pager, so the CSS transition can be
 * turned off and the panels follow the finger 1:1. */
export const [swiping, setSwiping] = createSignal(false);

/** Right-hand member drawer, opened by swiping left inside a room. */
export const [mobileMembersOpen, setMobileMembersOpen] = createSignal(false);
/** Set by the page currently on screen: whether this room has a member list to swipe to. */
export const [mobileMembersAvailable, setMobileMembersAvailable] = createSignal(false);

/** Which side is showing - what components that don't care about the pager ask for. */
export const mobileNavFocus = () => (mobilePanel() === 'nav' ? 'rails' : 'content');

export function openMobileRails() {
  setMobileMembersOpen(false);
  setMobilePanel('nav');
}

export function openMobileContent() {
  setMobilePanel('content');
}

/** Tapping a notification / conversation: go to the room, on the Home tab. */
export function openMobileRoom() {
  setMobileTab('home');
  setMobileMembersOpen(false);
  setMobilePanel('content');
}
