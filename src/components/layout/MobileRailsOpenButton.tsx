import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { isMdViewport, mobileNavFocus, openMobileRails } from '../../stores/mobileShellLayout';

/** Shown on small screens while main is full-screen so users can return to space + channel rails */
export const MobileRailsOpenButton: Component = () => (
  <Show when={!isMdViewport() && mobileNavFocus() === 'content'}>
    <button
      type="button"
      class="-ml-1 mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      aria-label="Show servers and channels"
      onClick={() => openMobileRails()}
    >
      <i class="fa-solid fa-bars" />
    </button>
  </Show>
);
