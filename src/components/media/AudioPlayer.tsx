import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createResource, onCleanup } from 'solid-js';
import { createMediaPlayer } from './createMediaPlayer';
import { createScrubber } from './createScrubber';
import { VolumeControl } from './VolumeControl';
import { clamp01, formatMediaTime, formatRate } from './format';
import { WAVEFORM_BARS, waveformPeaks } from './waveform';
import { formatFileSize } from '../../lib/attachments/format';
import { isRtl, t } from '../../i18n';

export interface AudioPlayerProps {
  src: string;
  filename: string;
  size: number;
  downloadUrl?: string;
  /** Slot for the upload progress bar while the file is still being sent. */
  children?: import('solid-js').JSX.Element;
}

/**
 * Attachment audio player: play button, waveform timeline (decoded from the file when it
 * is small enough, a plain bar otherwise), time readout, speed cycling, volume, download.
 * The waveform doubles as the seek surface: click or drag anywhere on it.
 */
export const AudioPlayer: Component<AudioPlayerProps> = (props) => {
  const player = createMediaPlayer();
  const duration = () => player.duration();
  const played = createMemo(() => (duration() > 0 ? clamp01(player.currentTime() / duration()) : 0));
  const scrubber = createScrubber({
    value: played,
    step: 0.05,
    rtl: isRtl,
    onScrub: (f) => player.seek(f * duration()),
    onCommit: (f) => player.seek(f * duration()),
  });
  const shown = createMemo(() => scrubber.dragging() ?? played());

  // Decode lazily and only once the browser is idle, so a long thread of voice clips
  // doesn't front-load a pile of decodes.
  const [peaks] = createResource(
    () => [props.src, props.size] as const,
    ([src, size]) =>
      new Promise<number[] | null>((resolve) => {
        const run = () => waveformPeaks(src, size).then(resolve, () => resolve(null));
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => void run(), { timeout: 1500 });
        else setTimeout(run, 50);
      })
  );
  const bars = createMemo(() => peaks() ?? null);

  let audioEl: HTMLAudioElement | undefined;
  createEffect(() => {
    // Re-point the element when the URL changes (an E2EE clip finishing decryption).
    if (audioEl && audioEl.getAttribute('src') !== props.src) audioEl.src = props.src;
  });
  onCleanup(() => player.pause());

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
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
      case 'm':
        player.toggleMute();
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  const label = () => (player.playing() ? t('attachments.player.pause') : t('attachments.player.play'));

  return (
    <div
      class="relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg border border-border/80 bg-card/40 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={props.filename}
    >
      <audio ref={(el) => { audioEl = el; player.attach(el); }} src={props.src} preload="metadata" />
      <button
        type="button"
        class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        aria-label={label()}
        title={label()}
        disabled={player.failed()}
        onClick={() => player.toggle()}
      >
        <Show
          when={!(player.waiting() && player.playing())}
          fallback={<i class="fa-solid fa-circle-notch animate-spin text-base" aria-hidden="true" />}
        >
          <i
            class={`fa-solid ${player.playing() ? 'fa-pause' : player.ended() ? 'fa-rotate-left' : 'fa-play'} ${player.playing() || player.ended() ? '' : 'ms-0.5'} text-base`}
            aria-hidden="true"
          />
        </Show>
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={props.filename}>
            {props.filename}
          </p>
          <button
            type="button"
            class="rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('attachments.player.speed')}
            title={t('attachments.player.speed')}
            onClick={() => player.cycleRate()}
          >
            {formatRate(player.rate())}
          </button>
          <VolumeControl player={player} tone="card" />
          <Show when={props.downloadUrl}>
            <a
              href={props.downloadUrl}
              download={props.filename}
              target="_blank"
              rel="noopener noreferrer"
              class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('attachments.downloadNamed', { name: props.filename })}
              title={t('attachments.download')}
            >
              <i class="fa-solid fa-download text-sm" aria-hidden="true" />
            </a>
          </Show>
        </div>

        <Show
          when={!player.failed()}
          fallback={<p class="mt-1 text-xs text-destructive">{t('attachments.player.unsupported')}</p>}
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label={t('attachments.player.seek')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration())}
            aria-valuenow={Math.round(player.currentTime())}
            aria-valuetext={`${formatMediaTime(player.currentTime())} / ${formatMediaTime(duration())}`}
            class="group/wave relative mt-1.5 flex h-9 w-full cursor-pointer touch-none items-end gap-px focus-visible:outline-none"
            onPointerDown={scrubber.onPointerDown}
            onPointerMove={scrubber.onPointerMove}
            onPointerUp={scrubber.onPointerUp}
            onPointerLeave={scrubber.onPointerLeave}
            onKeyDown={scrubber.onKeyDown}
          >
            <Show
              when={bars()}
              fallback={
                <div class="relative mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/25">
                  <div class="absolute inset-y-0 start-0 rounded-full bg-primary" style={{ width: `${shown() * 100}%` }} />
                </div>
              }
            >
              {(list) => (
                <For each={list()}>
                  {(peak, i) => {
                    const on = () => (i() + 0.5) / WAVEFORM_BARS <= shown();
                    return (
                      <div
                        class={`min-w-0 flex-1 rounded-sm transition-colors ${on() ? 'bg-primary' : 'bg-muted-foreground/35 group-hover/wave:bg-muted-foreground/50'}`}
                        style={{ height: `${Math.max(12, Math.round(peak * 100))}%` }}
                      />
                    );
                  }}
                </For>
              )}
            </Show>
            <Show when={bars() && (scrubber.hover() !== null || scrubber.dragging() !== null)}>
              <div
                class="pointer-events-none absolute inset-y-0 w-px bg-foreground/70"
                style={{ 'inset-inline-start': `${(scrubber.dragging() ?? scrubber.hover() ?? 0) * 100}%` }}
              />
            </Show>
          </div>
        </Show>

        <div class="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="font-mono tabular-nums">
            {formatMediaTime(player.currentTime())}
            <span class="text-muted-foreground/60"> / </span>
            {formatMediaTime(duration())}
          </span>
          <span>{formatFileSize(props.size)}</span>
        </div>
      </div>
      {props.children}
    </div>
  );
};
