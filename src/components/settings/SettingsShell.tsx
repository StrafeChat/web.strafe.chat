import type { Component, JSX } from 'solid-js';
import { For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createDialogBehavior, createDialogExit } from '../ui/dialogBehavior';
import { appModalBackdrop, appModalPanel, appSectionLabel, appSettingsSidebar, zLayer } from '../../theme/appChrome';

export interface SettingsShellProps {
  open: boolean;
  onClose: () => void;
  /** Stacking tier, one of `zLayer`. Defaults to `zLayer.modal`. */
  zClass?: string;
  /** id of the element that names the dialog */
  labelledBy: string;
  children: JSX.Element;
}

/**
 * Frame shared by every settings-style modal (user, space, room): backdrop, sized glass
 * panel, sidebar-plus-content layout, Escape / backdrop-click to close, focus trap. Content
 * is expected to be a `SettingsNav` followed by a `SettingsPanel`.
 */
export const SettingsShell: Component<SettingsShellProps> = (props) => (
  <Show when={props.open}>
    <Portal mount={document.body}>
      <SettingsFrame {...props} />
    </Portal>
  </Show>
);

/** Mounted only while open, so the dialog behaviour hooks can use mount / cleanup. */
const SettingsFrame: Component<SettingsShellProps> = (props) => {
  let overlay: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;
  const { onKeyDown } = createDialogBehavior({
    onClose: () => props.onClose(),
    panel: () => panel,
  });
  createDialogExit(() => overlay);

  return (
    <div
      ref={overlay}
      data-modal
      data-settings-backdrop
      class={`fixed inset-0 flex items-center justify-center p-3 sm:p-6 ${props.zClass ?? zLayer.modal} ${appModalBackdrop} dialog-overlay-in`}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.labelledBy}
        class={`flex min-h-0 min-w-0 flex-col overflow-hidden outline-none md:flex-row ${appModalPanel} dialog-panel-in`}
        style={{
          width: 'min(94vw, 60rem)',
          height: 'min(88vh, 46rem)',
          'min-height': 'min(420px, 88vh)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {props.children}
      </div>
    </div>
  );
};

export interface SettingsNavItemDef<T extends string = string> {
  id: T;
  label: string;
  icon: string;
  disabled?: boolean;
}

export interface SettingsNavGroup<T extends string = string> {
  label?: string;
  items: SettingsNavItemDef<T>[];
}

export interface SettingsNavProps<T extends string = string> {
  /** Small caps title at the top of the rail (e.g. "Settings", "Space settings"). */
  title: string;
  titleId?: string;
  groups: SettingsNavGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
  /** Extra content under the title (e.g. a search box). */
  header?: JSX.Element;
  /** Pinned to the bottom of the rail. */
  footer?: JSX.Element;
}

export const settingsNavButtonBase =
  'flex w-full shrink-0 items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Left rail of a settings modal. Collapses to a horizontal strip on small screens. */
export function SettingsNav<T extends string = string>(props: SettingsNavProps<T>): JSX.Element {
  return (
    <nav
      class={`flex shrink-0 flex-col overflow-hidden border-b border-border md:w-60 md:border-b-0 md:border-r ${appSettingsSidebar} bg-black/15`}
      aria-label={props.title}
    >
      <div class="shrink-0 space-y-3 border-b border-border/60 px-3 pb-3 pt-4">
        <p id={props.titleId} class={`px-1 ${appSectionLabel} tracking-[0.12em]`}>
          {props.title}
        </p>
        {props.header}
      </div>
      <div class="flex min-h-0 flex-1 flex-row gap-1 overflow-x-auto px-2 py-2 md:flex-col md:overflow-y-auto md:py-3">
        <For each={props.groups}>
          {(group, gi) => (
            <>
              <Show when={group.label}>
                <p
                  class={`hidden shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90 md:block ${
                    gi() > 0 ? 'mt-3' : ''
                  } mb-1.5`}
                >
                  {group.label}
                </p>
              </Show>
              <For each={group.items}>
                {(item) => (
                  <button
                    type="button"
                    disabled={item.disabled}
                    class={`${settingsNavButtonBase} w-auto md:w-full ${
                      props.active === item.id
                        ? 'bg-muted/80 text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    } ${item.disabled ? 'pointer-events-none opacity-40' : ''}`}
                    onClick={() => props.onSelect(item.id)}
                  >
                    <i class={`fa-solid ${item.icon} w-4 shrink-0 text-center text-[13px] opacity-90`} aria-hidden="true" />
                    <span class="truncate">{item.label}</span>
                  </button>
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <Show when={props.footer}>
        <div class="hidden shrink-0 border-t border-border/60 px-3 py-2.5 md:block">{props.footer}</div>
      </Show>
    </nav>
  );
}
