import type { Component, JSX } from 'solid-js';
import {
  appResponsiveDialogOverlay,
  appResponsiveDialogPanelMd,
  appResponsiveDialogPanelSm,
} from '../../theme/appChrome';

export interface ResponsiveDialogProps {
  /** `sm` ≈ max-w-sm on desktop; `md` ≈ max-w-md */
  size: 'sm' | 'md';
  /** e.g. `z-50`, `z-[200]` */
  zClass?: string;
  onBackdropClick: (e: MouseEvent) => void;
  children: JSX.Element;
  /** Appended to the sheet / dialog panel (padding, flex, relative, …) */
  panelClass?: string;
  /** When set, applied to the panel for a11y */
  ariaLabelledby?: string;
}

export const ResponsiveDialog: Component<ResponsiveDialogProps> = (props) => {
  const panelBase = () => (props.size === 'sm' ? appResponsiveDialogPanelSm : appResponsiveDialogPanelMd);
  return (
    <div
      class={`${appResponsiveDialogOverlay} ${props.zClass ?? 'z-50'}`}
      data-modal
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onBackdropClick(e);
      }}
    >
      <div
        class={`${panelBase()} ${props.panelClass ?? ''}`}
        role="dialog"
        aria-modal="true"
        {...(props.ariaLabelledby ? { 'aria-labelledby': props.ariaLabelledby } : {})}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex shrink-0 justify-center pb-0.5 pt-2 md:hidden" aria-hidden="true">
          <div class="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {props.children}
      </div>
    </div>
  );
};
