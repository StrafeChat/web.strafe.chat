import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { isMdViewport, mobileNavFocus, openMobileRails } from '../../stores/mobileShellLayout';
import { t } from '../../i18n';

/** Shown on small screens while main is full-screen so users can return to space + channel rails */
export const MobileRailsOpenButton: Component = () => (
  <Show when={!isMdViewport() && mobileNavFocus() === 'content'}>
    <button
      type="button"
      class="-ms-1 me-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
      aria-label={t('nav.showRails')}
      onClick={() => openMobileRails()}
    >
      <i class="fa-solid fa-bars" />
    </button>
  </Show>
);
