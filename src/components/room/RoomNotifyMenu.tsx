import type { Component } from 'solid-js';
import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { appMenuItemDefault, appMenuPanel, appSectionLabel, zLayer } from '../../theme/appChrome';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { t } from '../../i18n';
import { NotifyModeAll, NotifyModeDefault, NotifyModeMentions, NotifyModeNone } from '../../lib/roomNotify';

export interface RoomNotifyMenuProps {
  notifyMode: number;
  muted: boolean;
  onSetNotifyMode: (mode: number) => void;
  onMute: (durationMs: number | null) => void;
  onUnmute: () => void;
}

const MODES = [NotifyModeDefault, NotifyModeAll, NotifyModeMentions, NotifyModeNone];

const DURATIONS: { key: string; ms: number | null }[] = [
  { key: '15m', ms: 15 * 60 * 1000 },
  { key: '1h', ms: 60 * 60 * 1000 },
  { key: '8h', ms: 8 * 60 * 60 * 1000 },
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: 'forever', ms: null },
];

const MENU_WIDTH = 256;

/** Bell icon in the room header: notify-mode override (default/all/mentions/none) and
 * mute, mirroring Discord's per-channel notification settings menu.
 *
 * The panel is portaled rather than absolutely positioned inside the header: the header's
 * glass backdrop-filter makes it its own stacking context, so a menu nested inside it can
 * never paint over the message list that follows it in the DOM - which is exactly how this
 * menu ended up underneath (and un-clickable behind) the chat content. */
export const RoomNotifyMenu: Component<RoomNotifyMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [anchor, setAnchor] = createSignal<{ top: number; right: number } | null>(null);
  let rootEl: HTMLDivElement | undefined;

  function measure() {
    if (!rootEl) return;
    const r = rootEl.getBoundingClientRect();
    setAnchor({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }

  createEffect(() => {
    if (!open()) return;
    measure();
    const onReflow = () => measure();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    onCleanup(() => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    });
  });

  const onDocMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (rootEl?.contains(target as Node)) return;
    if (target?.closest?.('[data-notify-menu]')) return;
    setOpen(false);
  };
  const onDocKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onDocKey);
  onCleanup(() => {
    document.removeEventListener('mousedown', onDocMouseDown);
    document.removeEventListener('keydown', onDocKey);
  });

  return (
    <div class="relative" ref={(el) => (rootEl = el)}>
      <Tooltip label={props.muted ? t('room.notify.muted') : t('room.notify.title')} inline side="top">
        <IconButton
          icon={props.muted ? 'fa-solid fa-bell-slash' : 'fa-solid fa-bell'}
          label={t('room.notify.title')}
          title=""
          active={open()}
          tone={props.muted ? 'subtle' : 'default'}
          onClick={() => setOpen((v) => !v)}
        />
      </Tooltip>
      <Show when={open() && anchor()}>
        <Portal>
          <div
            data-notify-menu
            class={`fixed ${zLayer.popover} ${appMenuPanel}`}
            style={{ top: `${anchor()!.top}px`, right: `${anchor()!.right}px`, width: `${MENU_WIDTH}px` }}
            role="menu"
            aria-label={t('room.notify.title')}
          >
            <p class={`${appSectionLabel} px-2 pb-1 pt-1`}>{t('room.notify.title')}</p>
            <For each={MODES}>
              {(mode) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={props.notifyMode === mode}
                  class={`${appMenuItemDefault} justify-between`}
                  onClick={() => props.onSetNotifyMode(mode)}
                >
                  <span>{t(`room.notify.modes.${mode}`)}</span>
                  <Show when={props.notifyMode === mode}>
                    <i class="fa-solid fa-check text-xs text-primary" aria-hidden="true" />
                  </Show>
                </button>
              )}
            </For>
            <div class="my-1.5 border-t border-border/60" />
            <p class={`${appSectionLabel} px-2 pb-1 pt-1`}>{t('room.notify.muteSection')}</p>
            <Show
              when={!props.muted}
              fallback={
                <button
                  type="button"
                  role="menuitem"
                  class={appMenuItemDefault}
                  onClick={() => {
                    props.onUnmute();
                    setOpen(false);
                  }}
                >
                  <i class="fa-solid fa-bell w-4 text-xs" aria-hidden="true" />
                  <span>{t('room.notify.unmute')}</span>
                </button>
              }
            >
              <For each={DURATIONS}>
                {(d) => (
                  <button
                    type="button"
                    role="menuitem"
                    class={appMenuItemDefault}
                    onClick={() => {
                      props.onMute(d.ms);
                      setOpen(false);
                    }}
                  >
                    <i class="fa-solid fa-bell-slash w-4 text-xs" aria-hidden="true" />
                    <span>{t(`room.notify.duration.${d.key}`)}</span>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
