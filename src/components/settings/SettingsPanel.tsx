import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { IconButton } from '../ui/IconButton';
import { useSettingsMobileView } from './SettingsShell';
import { t } from '../../i18n';

export interface SettingsPanelProps {
  title: string;
  description?: string;
  /** id for the title element (aria-labelledby target) */
  titleId?: string;
  onClose: () => void;
  /** Rendered in the top-right of the header, before the close button (e.g. Save). */
  headerActions?: JSX.Element;
  children: JSX.Element;
}

/**
 * Right-hand content column of a settings modal: sticky header row + scrollable body. On a
 * phone it is the second screen, with a back arrow to the section list in its header.
 */
export const SettingsPanel: Component<SettingsPanelProps> = (props) => {
  const mobile = useSettingsMobileView();
  return (
    <div class={`flex min-h-0 min-w-0 flex-1 flex-col bg-background/40 ${mobile.view() === 'nav' ? 'max-md:hidden' : ''}`}>
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2 sm:px-6 md:px-5 md:py-3 max-md:pt-[max(0.5rem,env(safe-area-inset-top))]">
        <IconButton
          icon="fa-solid fa-chevron-left"
          label={t('settings.backToSections')}
          size="lg"
          class="md:hidden"
          onClick={() => mobile.setView('nav')}
        />
        <span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground md:hidden" aria-hidden>
          {props.title}
        </span>
        <span class="hidden text-xs text-muted-foreground md:inline" aria-hidden>
          {t('settings.escToClose')}
        </span>
        <div class="ms-auto flex shrink-0 items-center gap-2">
          {props.headerActions}
          <IconButton icon="fa-solid fa-xmark" label={t('common.close')} size="lg" onClick={props.onClose} />
        </div>
      </header>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-8 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div class="mx-auto max-w-5xl space-y-2 pb-8">
          <h2 id={props.titleId} class="text-2xl font-bold tracking-tight text-foreground sm:text-[1.65rem]">
            {props.title}
          </h2>
          <Show when={props.description}>
            <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">{props.description}</p>
          </Show>
          <div class="pt-5">{props.children}</div>
        </div>
      </div>
    </div>
  );
};
