import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createResource, onCleanup } from 'solid-js';
import { createMediaPlayer } from './createMediaPlayer';
import { createScrubber } from './createScrubber';
import { clamp01, formatMediaTime } from './format';
import { WAVEFORM_BARS, waveformPeaks } from './waveform';
import { formatFileSize } from '../../lib/attachments/format';
import { isRtl, t } from '../../i18n';

export interface VoiceMessagePlayerProps {
  src: string;
  size: number;
  /** Name to save the clip under; the CDN's own name is usually an opaque hash. */
  filename?: string;
  downloadUrl?: string;
  /** Slot for the upload progress bar while the clip is still being sent. */
  children?: import('solid-js').JSX.Element;
}

/**
 * A voice message: play/pause, a seekable waveform, and the elapsed/total time - the
 * compact one-line shape rather than the full AudioPlayer chrome (no filename, volume or
 * speed controls; those belong to a file you deliberately attached).
 *
 * The waveform is the seek surface, decoded from the clip itself, so nothing extra has to
 * be stored or shipped with the message and a clip recorded on Safari plays in Chrome and
 * vice versa. It is rendered from the right-hand edge in RTL, matching AudioPlayer.
 */
export const VoiceMessagePlayer: Component<VoiceMessagePlayerProps> = (props) => {
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

  // Same lazy decode as AudioPlayer, so a wall of voice messages doesn't front-load a pile
  // of them; voice clips are small, so this nearly always succeeds.
  const [peaks] = createResource(
    () => props.src,
    (src) =>
      new Promise<number[] | null>((resolve) => {
        const run = () => void waveformPeaks(src, props.size).then(resolve, () => resolve(null));
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
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  const label = () => (player.playing() ? t('attachments.player.pause') : t('attachments.player.play'));

  return (
    <div
      class="flex w-full max-w-sm items-center gap-3 rounded-lg border border-border/80 bg-card/40 p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={t('attachments.voice.label')}
    >
      <audio ref={(el) => { audioEl = el; player.attach(el); }} src={props.src} preload="metadata" />
      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        aria-label={label()}
        title={label()}
        disabled={player.failed()}
        onClick={() => player.toggle()}
      >
        <Show
          when={!(player.waiting() && player.playing())}
          fallback={<i class="fa-solid fa-circle-notch animate-spin text-sm" aria-hidden="true" />}
        >
          <i
            class={`fa-solid ${player.playing() ? 'fa-pause' : player.ended() ? 'fa-rotate-left' : 'fa-play'} ${
              player.playing() || player.ended() ? '' : 'ms-0.5'
            } text-sm`}
            aria-hidden="true"
          />
        </Show>
      </button>

      <div class="min-w-0 flex-1">
        <Show
          when={!player.failed()}
          fallback={<p class="text-xs text-destructive">{t('attachments.player.unsupported')}</p>}
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label={t('attachments.voice.seek')}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration())}
            aria-valuenow={Math.round(player.currentTime())}
            aria-valuetext={`${formatMediaTime(player.currentTime())} / ${formatMediaTime(duration())}`}
            class="group/wave relative flex h-8 w-full cursor-pointer touch-none items-end gap-px focus-visible:outline-none"
            onPointerDown={scrubber.onPointerDown}
            onPointerMove={scrubber.onPointerMove}
            onPointerUp={scrubber.onPointerUp}
            onPointerLeave={scrubber.onPointerLeave}
            onKeyDown={scrubber.onKeyDown}
          >
            <Show
              when={bars()}
              fallback={
                <div class="relative mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/25">
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

      <Show when={props.downloadUrl}>
        <a
          href={props.downloadUrl}
          download={props.filename ?? ''}
          target="_blank"
          rel="noopener noreferrer"
          class="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={props.filename ? t('attachments.downloadNamed', { name: props.filename }) : t('attachments.download')}
          title={t('attachments.download')}
        >
          <i class="fa-solid fa-download text-sm" aria-hidden="true" />
        </a>
      </Show>
      {props.children}
    </div>
  );
};
