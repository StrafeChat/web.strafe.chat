import type { Component } from 'solid-js';
import { Show, createMemo } from 'solid-js';
import type { MediaPlayer } from './createMediaPlayer';
import { createScrubber } from './createScrubber';
import { clamp01, formatMediaTime } from './format';
import { isRtl, t } from '../../i18n';

/**
 * Timeline for the video player: buffered range, played range, a thumb that grows on
 * hover, and a time bubble following the pointer. Dragging scrubs live.
 */
export const SeekBar: Component<{ player: MediaPlayer; class?: string }> = (props) => {
  const duration = () => props.player.duration();
  const played = createMemo(() => (duration() > 0 ? clamp01(props.player.currentTime() / duration()) : 0));
  const bufferedFrac = createMemo(() => (duration() > 0 ? clamp01(props.player.buffered() / duration()) : 0));
  const scrubber = createScrubber({
    value: played,
    step: 0.05,
    rtl: isRtl,
    onScrub: (f) => props.player.seek(f * duration()),
    onCommit: (f) => props.player.seek(f * duration()),
  });
  const shown = createMemo(() => scrubber.dragging() ?? played());
  const bubble = createMemo(() => scrubber.dragging() ?? scrubber.hover());

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={t('attachments.player.seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration())}
      aria-valuenow={Math.round(props.player.currentTime())}
      aria-valuetext={`${formatMediaTime(props.player.currentTime())} / ${formatMediaTime(duration())}`}
      class={`group/seek relative flex h-5 w-full cursor-pointer touch-none items-center focus-visible:outline-none ${props.class ?? ''}`}
      onPointerDown={scrubber.onPointerDown}
      onPointerMove={scrubber.onPointerMove}
      onPointerUp={scrubber.onPointerUp}
      onPointerLeave={scrubber.onPointerLeave}
      onKeyDown={scrubber.onKeyDown}
    >
      <div class="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/seek:h-1.5 group-focus-visible/seek:h-1.5">
        <div class="absolute inset-y-0 start-0 bg-white/30" style={{ width: `${bufferedFrac() * 100}%` }} />
        <div class="absolute inset-y-0 start-0 bg-primary" style={{ width: `${shown() * 100}%` }} />
      </div>
      <div
        class="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 scale-0 rounded-full bg-primary shadow transition-transform group-hover/seek:scale-100 group-focus-visible/seek:scale-100"
        style={{ 'inset-inline-start': `calc(${shown() * 100}% - 6px)` }}
      />
      <Show when={bubble() !== null && duration() > 0}>
        <div
          class="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white shadow"
          style={{ 'inset-inline-start': `${(bubble() ?? 0) * 100}%` }}
        >
          {formatMediaTime((bubble() ?? 0) * duration())}
        </div>
      </Show>
    </div>
  );
};
