import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { IconButton } from '../ui/IconButton';
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

/** Right-hand content column of a settings modal: sticky header row + scrollable body. */
export const SettingsPanel: Component<SettingsPanelProps> = (props) => (
  <div class="flex min-h-0 min-w-0 flex-1 flex-col bg-background/40">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-5 py-3 sm:px-6">
      <span class="hidden text-xs text-muted-foreground sm:inline" aria-hidden>
        {t('settings.escToClose')}
      </span>
      <div class="ms-auto flex items-center gap-2">
        {props.headerActions}
        <IconButton icon="fa-solid fa-xmark" label={t('common.close')} size="lg" onClick={props.onClose} />
      </div>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
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
