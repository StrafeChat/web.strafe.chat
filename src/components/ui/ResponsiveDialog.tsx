import type { Component, JSX } from 'solid-js';
import { createUniqueId, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { IconButton } from './IconButton';
import { createDialogBehavior, createDialogExit } from './dialogBehavior';
import {
  appDialogDescription,
  appDialogIconChip,
  appDialogIconTone,
  appDialogTitle,
  appResponsiveDialogOverlay,
  appResponsiveDialogPadding,
  appResponsiveDialogPanel,
  appResponsiveDialogWidth,
  zLayer,
} from '../../theme/appChrome';
import { t } from '../../i18n';

export type DialogTone = keyof typeof appDialogIconTone;

export interface ResponsiveDialogProps {
  /** `sm` ≈ max-w-sm on desktop, `md` ≈ max-w-md (default), `lg` ≈ max-w-lg. */
  size?: 'sm' | 'md' | 'lg';
  /** Stacking tier, one of `zLayer`. Defaults to `zLayer.modal`. */
  zClass?: string;
  /** Requested by Escape, a backdrop click and the close button. */
  onClose: () => void;
  /** When false the dialog can't be dismissed (e.g. while a request is in flight). */
  dismissible?: boolean;
  /** Standard header: title, optional description and optional icon chip. */
  title?: JSX.Element;
  description?: JSX.Element;
  /** Font Awesome class, e.g. `fa-solid fa-key`. */
  icon?: string;
  /** Colours the icon chip. */
  tone?: DialogTone;
  /** X in the top-end corner, for dialogs that have no Cancel action of their own. */
  closeButton?: boolean;
  /** Stack the header vertically and centre it (icon above the title). */
  centered?: boolean;
  /** Skip the inner padding; the caller lays out edge-to-edge content (banners, lists). */
  unpadded?: boolean;
  /** Extra classes on the panel. */
  panelClass?: string;
  /** Extra classes on the scrolling body. */
  bodyClass?: string;
  /** id of a heading rendered by the caller (when `title` is not used). */
  labelledBy?: string;
  children?: JSX.Element;
}

/**
 * The one dialog frame: portal, backdrop, bottom sheet on phones / centred card from md+,
 * enter animation, Escape + backdrop dismissal, focus trap and focus restore. Everything
 * that is not a settings shell renders through this so dialogs look and behave the same.
 */
export const ResponsiveDialog: Component<ResponsiveDialogProps> = (props) => {
  const uid = createUniqueId();
  const titleId = () => props.labelledBy ?? `dialog-${uid}-title`;
  const descId = `dialog-${uid}-desc`;
  let overlay: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;

  const dismissible = () => props.dismissible !== false;
  const { onKeyDown } = createDialogBehavior({
    onClose: () => props.onClose(),
    dismissible,
    panel: () => panel,
  });
  createDialogExit(() => overlay);

  function requestClose() {
    if (dismissible()) props.onClose();
  }

  const hasHeader = () => Boolean(props.title);
  const tone = () => props.tone ?? 'default';

  return (
    <Portal mount={document.body}>
      <div
        ref={overlay}
        class={`${appResponsiveDialogOverlay} ${props.zClass ?? zLayer.modal} dialog-overlay-in`}
        data-modal
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={hasHeader() || props.labelledBy ? titleId() : undefined}
          aria-describedby={props.description ? descId : undefined}
          class={`${appResponsiveDialogPanel} ${appResponsiveDialogWidth[props.size ?? 'md']} dialog-panel-in dialog-sheet touch-manipulation outline-none ${
            props.panelClass ?? ''
          }`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown}
        >
          <div
            class={`flex shrink-0 justify-center pb-0.5 pt-2 md:hidden ${props.unpadded ? 'pointer-events-none absolute inset-x-0 top-0 z-10' : ''}`}
            aria-hidden="true"
          >
            <div class={`h-1 w-10 rounded-sm ${props.unpadded ? 'bg-white/70 shadow-sm shadow-black/40' : 'bg-muted-foreground/30'}`} />
          </div>
          <Show when={props.closeButton}>
            <IconButton
              icon="fa-solid fa-xmark"
              label={t('common.close')}
              tone={props.unpadded ? 'overlay' : 'default'}
              class="absolute end-4 top-4 z-10"
              onClick={requestClose}
            />
          </Show>
          <div
            class={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain ${props.unpadded ? '' : appResponsiveDialogPadding} ${
              props.bodyClass ?? ''
            }`}
          >
            <Show when={hasHeader()}>
              <div
                class={`mb-4 shrink-0 ${
                  props.centered ? 'flex flex-col items-center text-center' : 'flex items-start gap-3'
                } ${props.closeButton ? (props.centered ? 'px-8' : 'pe-8') : ''}`}
              >
                <Show when={props.icon}>
                  <div
                    class={`${appDialogIconChip} ${appDialogIconTone[tone()]} ${
                      props.centered ? 'mb-3 size-12 text-xl' : 'size-10 text-base'
                    }`}
                  >
                    <i class={props.icon} aria-hidden="true" />
                  </div>
                </Show>
                <div class="min-w-0">
                  <h2 id={titleId()} class={appDialogTitle}>
                    {props.title}
                  </h2>
                  <Show when={props.description}>
                    <p id={descId} class={`${appDialogDescription} mt-1`}>
                      {props.description}
                    </p>
                  </Show>
                </div>
              </div>
            </Show>
            {props.children}
          </div>
        </div>
      </div>
    </Portal>
  );
};
