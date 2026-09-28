import type { Component } from 'solid-js';
import { createMemo } from 'solid-js';
import type { MediaPlayer } from './createMediaPlayer';
import { createScrubber } from './createScrubber';
import { isRtl, t } from '../../i18n';

/** Mute toggle plus a slider that slides open on hover/focus (video) or stays open (audio). */
export const VolumeControl: Component<{ player: MediaPlayer; alwaysOpen?: boolean; tone?: 'overlay' | 'card' }> = (props) => {
  const level = createMemo(() => (props.player.muted() ? 0 : props.player.volume()));
  const icon = createMemo(() => {
    const v = level();
    if (v === 0) return 'fa-volume-xmark';
    if (v < 0.5) return 'fa-volume-low';
    return 'fa-volume-high';
  });
  const scrubber = createScrubber({
    value: level,
    step: 0.1,
    rtl: isRtl,
    onScrub: (f) => props.player.setVolume(f),
    onCommit: (f) => props.player.setVolume(f),
  });
  const tone = () => props.tone ?? 'overlay';
  const buttonClass = () =>
    tone() === 'overlay'
      ? 'text-white/90 hover:text-white'
      : 'text-muted-foreground hover:text-foreground';
  const trackClass = () => (tone() === 'overlay' ? 'bg-white/30' : 'bg-muted-foreground/30');
  const fillClass = () => (tone() === 'overlay' ? 'bg-white' : 'bg-primary');

  return (
    <div class={`group/vol flex items-center ${props.alwaysOpen ? 'gap-2' : ''}`}>
      <button
        type="button"
        class={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${buttonClass()}`}
        aria-label={props.player.muted() ? t('attachments.player.unmute') : t('attachments.player.mute')}
        title={props.player.muted() ? t('attachments.player.unmute') : t('attachments.player.mute')}
        onClick={() => props.player.toggleMute()}
      >
        <i class={`fa-solid ${icon()} text-sm`} aria-hidden="true" />
      </button>
      <div
        class={`flex h-8 items-center overflow-hidden transition-[width,margin] duration-200 ${
          props.alwaysOpen ? 'w-16' : 'w-0 group-hover/vol:ms-1 group-hover/vol:w-16 group-focus-within/vol:ms-1 group-focus-within/vol:w-16'
        }`}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('attachments.player.volume')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level() * 100)}
          class="relative flex h-8 w-16 cursor-pointer touch-none items-center focus-visible:outline-none"
          onPointerDown={scrubber.onPointerDown}
          onPointerMove={scrubber.onPointerMove}
          onPointerUp={scrubber.onPointerUp}
          onPointerLeave={scrubber.onPointerLeave}
          onKeyDown={scrubber.onKeyDown}
        >
          <div class={`relative h-1 w-full overflow-hidden rounded-full ${trackClass()}`}>
            <div class={`absolute inset-y-0 start-0 rounded-full ${fillClass()}`} style={{ width: `${level() * 100}%` }} />
          </div>
          <div
            class={`pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full shadow ${fillClass()}`}
            style={{ 'inset-inline-start': `calc(${level() * 100}% - 6px)` }}
          />
        </div>
      </div>
    </div>
  );
};
