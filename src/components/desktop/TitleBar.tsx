import type { Component } from 'solid-js';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { desktopPlatform } from '../../desktop/env';
import { desktopWindow } from '../../desktop/native';
import { authGlassTint } from '../auth/authLayout';
import { t } from '../../i18n';

const controlClass =
  'flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:bg-accent/70 focus-visible:outline-none';

/** The three window glyphs, drawn as 1px lines (an icon font's are too heavy at this size). */
const Glyph: Component<{ kind: 'minimize' | 'maximize' | 'restore' | 'close' }> = (props) => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
    <Show when={props.kind === 'minimize'}>
      <path d="M0.5 5.5h9" />
    </Show>
    <Show when={props.kind === 'maximize'}>
      <rect x="0.5" y="0.5" width="9" height="9" />
    </Show>
    <Show when={props.kind === 'restore'}>
      <path d="M2.5 2.5v-2h7v7h-2" />
      <rect x="0.5" y="2.5" width="7" height="7" />
    </Show>
    <Show when={props.kind === 'close'}>
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </Show>
  </svg>
);

/**
 * The desktop app's own title bar, the one Discord has: a thin strip above the app that
 * drags the window and carries the window buttons, so the OS chrome is not a different
 * colour and style from everything under it. On macOS the native traffic lights stay (the
 * window is created with an overlay title bar) and the strip just leaves room for them.
 * Dragging and the double-click-to-maximise are the shell's doing, through the
 * data-tauri-drag-region attribute.
 */
export const DesktopTitleBar: Component = () => {
  const mac = desktopPlatform() === 'mac';
  const [maximized, setMaximized] = createSignal(false);

  onMount(() => {
    void desktopWindow.isMaximized().then(setMaximized).catch(() => undefined);
    const unlisten = desktopWindow.onMaximizeChange(setMaximized);
    onCleanup(() => {
      void unlisten.then((off) => off()).catch(() => undefined);
    });
  });

  return (
    <div
      data-tauri-drag-region
      class={`fixed inset-x-0 top-0 z-[500] flex h-[var(--desktop-titlebar-height)] select-none items-center border-b border-border ${authGlassTint} ${
        mac ? 'ps-[78px]' : 'ps-3'
      }`}
    >
      {/* The mark only: the page under it already says Strafe where it matters (the
          sign-in page's wordmark), and a title bar is not the place to say it twice. */}
      <img src="/icons/strafe-mark.png" alt="" class="pointer-events-none size-4" draggable={false} />
      <Show when={!mac}>
        <div class="ms-auto flex h-full items-stretch">
          <button type="button" class={controlClass} aria-label={t('desktop.titleBar.minimize')} onClick={() => void desktopWindow.minimize()}>
            <Glyph kind="minimize" />
          </button>
          <button
            type="button"
            class={controlClass}
            aria-label={maximized() ? t('desktop.titleBar.restore') : t('desktop.titleBar.maximize')}
            onClick={() => void desktopWindow.toggleMaximize()}
          >
            <Glyph kind={maximized() ? 'restore' : 'maximize'} />
          </button>
          <button
            type="button"
            class={`${controlClass} hover:bg-destructive hover:text-white focus-visible:bg-destructive focus-visible:text-white`}
            aria-label={t('desktop.titleBar.close')}
            onClick={() => void desktopWindow.close()}
          >
            <Glyph kind="close" />
          </button>
        </div>
      </Show>
    </div>
  );
};
