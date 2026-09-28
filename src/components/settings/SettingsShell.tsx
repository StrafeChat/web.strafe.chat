import type { Component, JSX } from 'solid-js';
import { createContext, createSignal, For, Show, useContext } from 'solid-js';
import { Portal } from 'solid-js/web';
import { createDialogBehavior, createDialogExit } from '../ui/dialogBehavior';
import { isMdViewport } from '../../stores/mobileShellLayout';
import { appModalBackdrop, appModalPanel, appSectionLabel, appSettingsSidebar, zLayer } from '../../theme/appChrome';

/**
 * Which half a phone is showing. Below `md` the rail and the page cannot sit side by side,
 * so the shell becomes a two-level screen: the list of sections, then the chosen section
 * with a back arrow - the shape every mobile settings screen has. Desktop ignores it.
 */
export type SettingsMobileView = 'nav' | 'panel';

const SettingsMobileContext = createContext<{
  view: () => SettingsMobileView;
  setView: (v: SettingsMobileView) => void;
}>();

export interface SettingsShellProps {
  open: boolean;
  onClose: () => void;
  /** Stacking tier, one of `zLayer`. Defaults to `zLayer.modal`. */
  zClass?: string;
  /** id of the element that names the dialog */
  labelledBy: string;
  /** On a phone, start on the section page rather than the list - for a caller that
   * opened the modal straight to a section (Settings → Instance from a link). */
  initialMobileView?: SettingsMobileView;
  children: JSX.Element;
}

/**
 * Frame shared by every settings-style modal (user, space, room): backdrop, sized glass
 * panel, sidebar-plus-content layout, Escape / backdrop-click to close, focus trap. Content
 * is expected to be a `SettingsNav` followed by a `SettingsPanel`. On a phone it fills the
 * screen and shows one of the two at a time.
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
  const [view, setView] = createSignal<SettingsMobileView>(props.initialMobileView ?? 'nav');

  return (
    <SettingsMobileContext.Provider value={{ view, setView }}>
      <div
        ref={overlay}
        data-modal
        data-settings-backdrop
        class={`fixed inset-0 flex items-center justify-center p-0 md:p-6 ${props.zClass ?? zLayer.modal} ${appModalBackdrop} dialog-overlay-in`}
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
          class={`flex min-h-0 min-w-0 flex-col overflow-hidden outline-none md:flex-row ${appModalPanel} dialog-panel-in max-md:h-full max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0`}
          style={
            isMdViewport()
              ? {
                  width: 'min(94vw, 60rem)',
                  height: 'min(88vh, 46rem)',
                  'min-height': 'min(420px, 88vh)',
                }
              : undefined
          }
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown}
        >
          {props.children}
        </div>
      </div>
    </SettingsMobileContext.Provider>
  );
};

/** The mobile view of the enclosing shell; a no-op outside one. */
export function useSettingsMobileView() {
  return useContext(SettingsMobileContext) ?? { view: () => 'nav' as SettingsMobileView, setView: () => undefined };
}

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

/**
 * Left rail of a settings modal. On a phone it is the whole first screen - a full-width
 * list of sections - and steps aside once one is picked.
 */
export function SettingsNav<T extends string = string>(props: SettingsNavProps<T>): JSX.Element {
  const mobile = useSettingsMobileView();
  return (
    <nav
      class={`flex shrink-0 flex-col overflow-hidden md:w-60 md:border-r ${appSettingsSidebar} bg-black/15 max-md:min-h-0 max-md:flex-1 ${
        mobile.view() === 'panel' ? 'max-md:hidden' : ''
      }`}
      aria-label={props.title}
    >
      <div class="shrink-0 space-y-3 border-b border-border/60 px-3 pb-3 pt-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]">
        <p id={props.titleId} class={`px-1 ${appSectionLabel} tracking-[0.12em]`}>
          {props.title}
        </p>
        {props.header}
      </div>
      <div class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3">
        <For each={props.groups}>
          {(group, gi) => (
            <>
              <Show when={group.label}>
                <p
                  class={`shrink-0 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/90 ${
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
                    class={`${settingsNavButtonBase} max-md:py-3 ${
                      props.active === item.id
                        ? 'bg-muted/80 text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    } ${item.disabled ? 'pointer-events-none opacity-40' : ''}`}
                    onClick={() => {
                      props.onSelect(item.id);
                      mobile.setView('panel');
                    }}
                  >
                    <i class={`fa-solid ${item.icon} w-4 shrink-0 text-center text-[13px] opacity-90`} aria-hidden="true" />
                    <span class="truncate">{item.label}</span>
                    <i class="fa-solid fa-chevron-right ms-auto text-[11px] text-muted-foreground/70 md:hidden" aria-hidden="true" />
                  </button>
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <Show when={props.footer}>
        <div class="shrink-0 border-t border-border/60 px-3 py-2.5 max-md:pb-[max(0.625rem,env(safe-area-inset-bottom))]">{props.footer}</div>
      </Show>
    </nav>
  );
}
