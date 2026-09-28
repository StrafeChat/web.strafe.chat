import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { updateAvailable } from '../stores/updateAvailable';
import { t } from '../i18n';

/**
 * A bottom-centre pill shown when a newer build has been deployed while this tab was open.
 * "Update" simply reloads - index.html is served no-cache and assets are content-hashed, so
 * a reload always lands on the fresh build.
 */
export const UpdateAvailableBanner: Component = () => (
  <Show when={updateAvailable()}>
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[350] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div class="pointer-events-auto flex items-center gap-3 rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-sm shadow-lg shadow-black/25 backdrop-blur-md">
        <i class="fa-solid fa-arrow-rotate-right text-primary" aria-hidden="true" />
        <span class="text-foreground">{t('update.available')}</span>
        <button
          type="button"
          class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          onClick={() => window.location.reload()}
        >
          {t('update.action')}
        </button>
      </div>
    </div>
  </Show>
);
