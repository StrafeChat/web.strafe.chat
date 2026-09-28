import type { Component } from 'solid-js';
import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { createMediaPlayer } from './createMediaPlayer';
import { SeekBar } from './SeekBar';
import { VolumeControl } from './VolumeControl';
import { formatMediaTime, formatRate } from './format';
import { fitWithin } from '../../lib/attachments/format';
import { t } from '../../i18n';

const MAX_W = 400;
const MAX_H = 300;
/** How long the controls stay after the pointer stops moving while playing. */
const HIDE_AFTER_MS = 2500;

export interface VideoPlayerProps {
  src: string;
  filename: string;
  width?: number;
  height?: number;
  /** Where the download button points (the decrypted object URL for E2EE clips). */
  downloadUrl?: string;
  class?: string;
}

/**
 * Attachment video player: click-to-play surface, auto-hiding overlay controls
 * (play/pause, timeline with hover time, volume, speed, picture-in-picture, fullscreen,
 * download), keyboard shortcuts on the focused player (space/k, ←/→ 5s, j/l 10s, ↑/↓
 * volume, m, f), and a buffering indicator. Inline it is sized like an image attachment;
 * fullscreen it takes the whole screen.
 */
export const VideoPlayer: Component<VideoPlayerProps> = (props) => {
  const player = createMediaPlayer();
  let root: HTMLDivElement | undefined;
  const [controlsVisible, setControlsVisible] = createSignal(true);
  const [fullscreen, setFullscreen] = createSignal(false);
  const [speedOpen, setSpeedOpen] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const hasDims = () => (props.width ?? 0) > 0 && (props.height ?? 0) > 0;
  const box = createMemo(() => fitWithin(props.width ?? 0, props.height ?? 0, MAX_W, MAX_H));
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  function showControls() {
    setControlsVisible(true);
    if (hideTimer) clearTimeout(hideTimer);
    if (player.playing() && !speedOpen()) {
      hideTimer = setTimeout(() => setControlsVisible(false), HIDE_AFTER_MS);
    }
  }

  // Paused or finished: controls stay. Playing: they fade after a moment of stillness.
  createEffect(() => {
    if (player.playing()) showControls();
    else {
      if (hideTimer) clearTimeout(hideTimer);
      setControlsVisible(true);
    }
  });

  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });

  function onFullscreenChange() {
    setFullscreen(document.fullscreenElement === root);
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  onCleanup(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

  async function toggleFullscreen() {
    if (!root) return;
    try {
      if (document.fullscreenElement === root) await document.exitFullscreen();
      else await root.requestFullscreen();
    } catch {
      // Not permitted (e.g. iframe without allowfullscreen); nothing to do.
    }
  }

  let videoEl: HTMLVideoElement | undefined;
  async function togglePip() {
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement === videoEl) await document.exitPictureInPicture();
      else await videoEl.requestPictureInPicture();
    } catch {
      // Unsupported for this stream; ignore.
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    // Sliders handle their own arrow keys.
    if (target?.getAttribute('role') === 'slider' && e.key.startsWith('Arrow')) return;
    switch (e.key) {
      case ' ':
      case 'k':
        player.toggle();
        break;
      case 'ArrowLeft':
        player.seekBy(-5);
        break;
      case 'ArrowRight':
        player.seekBy(5);
        break;
      case 'j':
        player.seekBy(-10);
        break;
      case 'l':
        player.seekBy(10);
        break;
      case 'ArrowUp':
        player.setVolume(player.volume() + 0.1);
        break;
      case 'ArrowDown':
        player.setVolume(player.volume() - 0.1);
        break;
      case 'm':
        player.toggleMute();
        break;
      case 'f':
        void toggleFullscreen();
        break;
      case 'Escape':
        if (speedOpen()) setSpeedOpen(false);
        else return;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    showControls();
  }

  const label = () => (player.playing() ? t('attachments.player.pause') : t('attachments.player.play'));

  return (
    <div
      ref={root}
      class={`group/video relative select-none overflow-hidden bg-black text-white outline-none ${
        fullscreen() ? 'flex h-full w-full items-center justify-center' : 'rounded-lg'
      } ${controlsVisible() ? '' : 'cursor-none'} ${props.class ?? ''}`}
      style={
        fullscreen()
          ? undefined
          : hasDims()
            ? { width: `${box().width}px`, height: `${box().height}px` }
            : { width: `${MAX_W}px`, 'max-width': '100%', 'aspect-ratio': '16 / 9', 'max-height': `${MAX_H}px` }
      }
      tabIndex={0}
      aria-label={props.filename}
      onKeyDown={onKeyDown}
      onPointerMove={showControls}
      onPointerLeave={() => {
        if (player.playing() && !speedOpen()) setControlsVisible(false);
      }}
    >
      <video
        ref={(el) => {
          videoEl = el;
          player.attach(el);
        }}
        src={props.src}
        preload="metadata"
        playsinline
        class={`block ${fullscreen() ? 'max-h-full max-w-full' : 'size-full object-contain'}`}
        onClick={() => player.toggle()}
        onDblClick={() => void toggleFullscreen()}
      />

      {/* Centre state: big play button, buffering spinner, or the error notice. */}
      <Show when={player.failed()}>
        <div class="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-white/80">
          {t('attachments.player.unsupported')}
        </div>
      </Show>
      <Show when={!player.failed() && !player.playing()}>
        <button
          type="button"
          class="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={label()}
          title={label()}
          onClick={() => player.toggle()}
        >
          <i class={`fa-solid ${player.ended() ? 'fa-rotate-left' : 'fa-play'} ${player.ended() ? 'text-xl' : 'ms-1 text-2xl'}`} aria-hidden="true" />
        </button>
      </Show>
      <Show when={player.waiting() && player.playing()}>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <i class="fa-solid fa-circle-notch animate-spin text-3xl text-white/80" aria-hidden="true" />
        </div>
      </Show>

      {/* Bottom controls. */}
      <div
        class={`absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 ${
          controlsVisible() ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <SeekBar player={player} />
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={label()}
            title={label()}
            onClick={() => player.toggle()}
          >
            <i class={`fa-solid ${player.playing() ? 'fa-pause' : 'fa-play'} text-sm`} aria-hidden="true" />
          </button>
          <VolumeControl player={player} />
          <span class="ms-1 font-mono text-[11px] tabular-nums text-white/85" aria-live="off">
            {formatMediaTime(player.currentTime())}
            <span class="text-white/50"> / </span>
            {formatMediaTime(player.duration())}
          </span>
          <div class="flex-1" />
          <div class="relative">
            <button
              type="button"
              class={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 font-mono text-[11px] tabular-nums transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                speedOpen() ? 'bg-white/15 text-white' : 'text-white/90'
              }`}
              aria-label={t('attachments.player.speed')}
              title={t('attachments.player.speed')}
              aria-haspopup="menu"
              aria-expanded={speedOpen()}
              onClick={() => setSpeedOpen((v) => !v)}
            >
              {formatRate(player.rate())}
            </button>
            <Show when={speedOpen()}>
              <div
                role="menu"
                class="absolute bottom-full end-0 mb-2 min-w-20 rounded-lg border border-white/10 bg-black/90 p-1 shadow-xl backdrop-blur"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={player.rate() === r}
                    class={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-start font-mono text-[12px] tabular-nums hover:bg-white/15 ${
                      player.rate() === r ? 'text-primary' : 'text-white/90'
                    }`}
                    onClick={() => {
                      player.setRate(r);
                      setSpeedOpen(false);
                      showControls();
                    }}
                  >
                    {formatRate(r)}
                    <Show when={player.rate() === r}>
                      <i class="fa-solid fa-check text-[10px]" aria-hidden="true" />
                    </Show>
                  </button>
                ))}
              </div>
            </Show>
          </div>
          <Show when={pipSupported}>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('attachments.player.pip')}
              title={t('attachments.player.pip')}
              onClick={() => void togglePip()}
            >
              <i class="fa-solid fa-window-restore text-sm" aria-hidden="true" />
            </button>
          </Show>
          <Show when={props.downloadUrl}>
            <a
              href={props.downloadUrl}
              download={props.filename}
              target="_blank"
              rel="noopener noreferrer"
              class="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('attachments.downloadNamed', { name: props.filename })}
              title={t('attachments.download')}
            >
              <i class="fa-solid fa-download text-sm" aria-hidden="true" />
            </a>
          </Show>
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={fullscreen() ? t('attachments.player.exitFullscreen') : t('attachments.player.fullscreen')}
            title={fullscreen() ? t('attachments.player.exitFullscreen') : t('attachments.player.fullscreen')}
            onClick={() => void toggleFullscreen()}
          >
            <i class={`fa-solid ${fullscreen() ? 'fa-compress' : 'fa-expand'} text-sm`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
