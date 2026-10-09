import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { desktopUpdate, dismissDesktopUpdate, installDesktopUpdate } from '../../desktop/updater';
import { t } from '../../i18n';

/**
 * The desktop counterpart of UpdateAvailableBanner: a new version downloads in the
 * background and this pill offers the restart once it is ready. Nothing is installed
 * until the person says so.
 */
export const DesktopUpdateBanner: Component = () => {
  const visible = () =>
    !desktopUpdate.dismissed &&
    (desktopUpdate.status === 'downloading' || desktopUpdate.status === 'ready' || desktopUpdate.status === 'installing');
  const label = () => {
    switch (desktopUpdate.status) {
      case 'downloading':
        return t('desktop.update.downloading', { version: desktopUpdate.version, progress: desktopUpdate.progress });
      case 'installing':
        return t('desktop.update.installing');
      default:
        return t('desktop.update.ready', { version: desktopUpdate.version });
    }
  };
  return (
    <Show when={visible()}>
      <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[350] flex justify-center px-3 pb-3">
        <div
          role="status"
          class="pointer-events-auto flex items-center gap-3 rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-sm shadow-lg shadow-black/25 backdrop-blur-md"
        >
          <Show
            when={desktopUpdate.status === 'ready'}
            fallback={<i class="fa-solid fa-arrows-rotate animate-spin text-primary" aria-hidden="true" />}
          >
            <i class="fa-solid fa-arrow-rotate-right text-primary" aria-hidden="true" />
          </Show>
          <span class="text-foreground">{label()}</span>
          <Show when={desktopUpdate.status === 'ready'}>
            <button
              type="button"
              class="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              onClick={() => void installDesktopUpdate()}
            >
              {t('desktop.update.restart')}
            </button>
            <button
              type="button"
              class="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={dismissDesktopUpdate}
            >
              {t('desktop.update.later')}
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
};
