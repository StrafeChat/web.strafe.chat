import type { Component } from 'solid-js';
import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  closeMediaViewer,
  goToMedia,
  mediaViewer,
  nextMedia,
  prevMedia,
} from '../../stores/mediaViewer';
import type { MediaViewerItem } from '../../stores/mediaViewer';
import { createDialogBehavior, createDialogExit } from '../ui/dialogBehavior';
import { IconButton } from '../ui/IconButton';
import { zLayer } from '../../theme/appChrome';
import { formatFileSize } from '../../lib/attachments/format';
import { t } from '../../i18n';

const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

/**
 * The full-screen image viewer.
 *
 * App-wide and store-driven rather than owned by whichever component opened it, because three
 * different surfaces need it - a message's attachments, a link-preview card, and a bare image
 * URL in message text - and a viewer that lives inside one of them can't be opened from the
 * others. It also outlives the row that opened it: clicking the last image of a message and
 * scrolling the list used to be impossible, because the viewer was a child of that row and
 * went away with it.
 */
export const MediaViewer: Component = () => (
  <Show when={mediaViewer.open}>
    <MediaViewerFrame />
  </Show>
);

/** Mounted only while open, so the dialog hooks can use mount / cleanup. */
const MediaViewerFrame: Component = () => {
  let overlay: HTMLDivElement | undefined;
  let panel: HTMLDivElement | undefined;
  const { onKeyDown } = createDialogBehavior({ onClose: closeMediaViewer, panel: () => panel });
  createDialogExit(() => overlay);

  const items = () => mediaViewer.items;
  const current = () => items()[mediaViewer.index];
  const many = () => items().length > 1;
  const [zoomFor, setZoomFor] = createSignal<{ url: string; zoom: number } | null>(null);
  const [failedUrl, setFailedUrl] = createSignal<string | null>(null);
  const [loadedUrl, setLoadedUrl] = createSignal<string | null>(null);

  // Load/zoom/failure state is keyed by URL rather than reset in an effect watching the index.
  // It resets itself the moment you move to another image, so a 4x view of image 2 can't
  // follow you to image 3 and a failure on one image can't blank the next - and there's no
  // effect to run (or to get subtly wrong) when the viewer is opened while already open.
  const url = () => current()?.url ?? '';
  const zoom = () => (zoomFor()?.url === url() ? zoomFor()!.zoom : 1);
  const setZoom = (z: number) => setZoomFor({ url: url(), zoom: z });
  const failed = () => !!url() && failedUrl() === url();
  const loaded = () => loadedUrl() === url();

  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom());
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + dir))];
    if (next != null) setZoom(next);
  };

  // Warm the neighbours so the arrows feel instant rather than flashing a skeleton.
  createEffect(() => {
    const list = items();
    if (list.length < 2) return;
    for (const d of [-1, 1]) {
      const n = list[(mediaViewer.index + d + list.length) % list.length];
      if (n) new Image().src = n.url;
    }
  });

  const onKeyDownGlobal = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextMedia();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevMedia();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      stepZoom(1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      stepZoom(-1);
    } else if (e.key === '0') {
      e.preventDefault();
      setZoom(1);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      void overlay?.requestFullscreen?.().catch(() => undefined);
    }
  };

  // Arrow keys have to work while focus sits on the filmstrip buttons, not only on the panel,
  // so this is on window rather than on the panel's onKeyDown.
  window.addEventListener('keydown', onKeyDownGlobal);
  onCleanup(() => window.removeEventListener('keydown', onKeyDownGlobal));

  const stage = () => (zoom() === 1 ? 'max-h-full max-w-full' : 'max-h-none max-w-none');

  const download = (it: MediaViewerItem) => {
    const a = document.createElement('a');
    a.href = it.url;
    a.download = it.filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const navButton = (dir: 'prev' | 'next') => (
    <Show when={many()}>
      <IconButton
        icon={dir === 'prev' ? 'fa-solid fa-chevron-left' : 'fa-solid fa-chevron-right'}
        label={dir === 'prev' ? t('attachments.viewer.previous') : t('attachments.viewer.next')}
        tone="overlay"
        size="lg"
        class={`absolute top-1/2 z-10 -translate-y-1/2 ${dir === 'prev' ? 'start-2' : 'end-2'}`}
        onClick={() => (dir === 'prev' ? prevMedia() : nextMedia())}
      />
    </Show>
  );

  return (
    <Portal mount={document.body}>
      <div
        ref={overlay}
        data-modal
        class={`fixed inset-0 flex flex-col ${zLayer.lightbox} bg-black/92 backdrop-blur-sm dialog-overlay-in`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMediaViewer();
        }}
      >
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={t('attachments.viewer.label')}
          class="flex min-h-0 flex-1 flex-col outline-none"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown}
        >
          {/* Top bar: name + position, and the controls. */}
          <div class="flex shrink-0 items-center gap-2 px-3 py-2.5 text-white/85">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{current()?.filename}</p>
              <Show when={many()}>
                <p class="text-[11px] tabular-nums text-white/50">
                  {t('attachments.viewer.position', {
                    current: mediaViewer.index + 1,
                    total: items().length,
                  })}
                </p>
              </Show>
            </div>
            <Show when={failed()} fallback={
              <>
                <IconButton
                  icon="fa-solid fa-magnifying-glass-minus"
                  label={t('attachments.viewer.zoomOut')}
                  tone="overlay"
                  disabled={zoom() <= 1}
                  onClick={() => stepZoom(-1)}
                />
                <Show when={zoom() !== 1}>
                  <span class="min-w-10 text-center text-xs tabular-nums text-white/70">
                    {Math.round(zoom() * 100)}%
                  </span>
                </Show>
                <IconButton
                  icon="fa-solid fa-magnifying-glass-plus"
                  label={t('attachments.viewer.zoomIn')}
                  tone="overlay"
                  disabled={zoom() >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                  onClick={() => stepZoom(1)}
                />
              </>
            }>
              <span class="text-xs text-white/70">{t('attachments.viewer.failed')}</span>
            </Show>
            <Show when={current()}>
              <IconButton
                icon="fa-solid fa-download"
                label={t('attachments.download')}
                tone="overlay"
                onClick={() => current() && download(current()!)}
              />
            </Show>
            <IconButton icon="fa-solid fa-xmark" label={t('common.close')} tone="overlay" onClick={closeMediaViewer} />
          </div>

          {/* Stage: the image, or the per-image error notice. Clicking the backdrop closes. */}
          <div class="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-6">
            {navButton('prev')}
            <Show
              when={current()}
              fallback={<p class="text-sm text-white/60">{t('attachments.viewer.failed')}</p>}
            >
              <Show
                when={!failed()}
                fallback={
                  <p class="max-w-xs text-center text-sm text-white/60">{t('attachments.viewer.failed')}</p>
                }
              >
                <Show when={!loaded()}>
                  <div class="media-skeleton absolute inset-4 rounded-lg opacity-40" />
                </Show>
                <img
                  src={current()!.url}
                  alt={current()!.filename}
                  onLoad={() => setLoadedUrl(url())}
                  onError={() => setFailedUrl(url())}
                  decoding="async"
                  class={`${stage()} rounded-lg object-contain shadow-2xl transition-opacity duration-200 ${
                    loaded() ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={zoom() !== 1 ? { width: `${zoom() * 100}%` } : undefined}
                />
              </Show>
            </Show>
            {navButton('next')}
          </div>

          {/* Filmstrip + facts. Only when there's more than one image, or facts worth showing. */}
          <Show when={many()}>
            <div class="flex shrink-0 justify-start gap-1.5 overflow-x-auto px-3 pb-1.5">
              <For each={items()}>
                {(it, i) => (
                  <button
                    type="button"
                    onClick={() => goToMedia(i())}
                    aria-current={i() === mediaViewer.index}
                    aria-label={it.filename}
                    title={it.filename}
                    class={`size-12 shrink-0 overflow-hidden rounded border transition ${
                      i() === mediaViewer.index
                        ? 'border-white/90 opacity-100'
                        : 'border-white/20 opacity-55 hover:opacity-90'
                    }`}
                  >
                    <img src={it.url} alt="" loading="lazy" decoding="async" class="size-full object-cover" draggable={false} />
                  </button>
                )}
              </For>
            </div>
          </Show>

          <Show when={current()?.size || current()?.width}>
            <p class="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[11px] text-white/45">
              <Show when={current()?.size}>{(s) => <>{formatFileSize(s())} · </>}</Show>
              <Show when={(current()?.width ?? 0) > 0}>
                {current()!.width}×{current()!.height}
              </Show>
            </p>
          </Show>
        </div>
      </div>
    </Portal>
  );
};