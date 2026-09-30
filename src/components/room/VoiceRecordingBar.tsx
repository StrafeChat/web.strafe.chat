import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { IconButton } from '../ui/IconButton';
import { formatMediaTime } from '../media';
import { WAVEFORM_BARS } from '../media/waveform';
import { t } from '../../i18n';

export interface VoiceRecordingBarProps {
  /** Input levels so far, oldest first, each 0..1. */
  levels: number[];
  elapsedMs: number;
  maxMs: number;
  onStop: () => void;
  onCancel: () => void;
}

/**
 * The composer's recording state: a live waveform that fills up as you talk, the elapsed
 * time, and the two things you can do - stop and send it, or throw it away. It sits in
 * the same slot as the text field, so starting a recording doesn't leave a live composer
 * behind it.
 */
export const VoiceRecordingBar: Component<VoiceRecordingBarProps> = (props) => {
  // The waveform is a fixed number of slots that fill left to right, so it grows the way
  // Discord's does instead of rescaling on every sample.
  const filled = () => Math.min(WAVEFORM_BARS, props.levels.length);
  const levelAt = (i: number) => props.levels[Math.min(i, props.levels.length - 1)] ?? 0;
  const seconds = () => props.elapsedMs / 1000;
  // Warn only once the cap is close, so the number doesn't sit there nagging all recording.
  const remaining = () => Math.max(0, (props.maxMs - props.elapsedMs) / 1000);
  const nearCap = () => remaining() <= 30;

  return (
    <div class="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5">
      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('attachments.voice.stop')}
        title={t('attachments.voice.stop')}
        onClick={() => props.onStop()}
      >
        <i class="fa-solid fa-stop text-xs" aria-hidden="true" />
      </button>

      <div class="min-w-0 flex-1">
        <div class="flex h-8 items-end gap-px" aria-hidden="true">
          <For each={Array.from({ length: WAVEFORM_BARS })}>
            {(_, i) => {
              const on = () => i() < filled();
              return (
                <div
                  class={`min-w-0 flex-1 rounded-sm ${on() ? 'bg-destructive' : 'bg-muted-foreground/20'}`}
                  style={{ height: `${on() ? Math.max(12, Math.round(levelAt(i()) * 100)) : 20}%` }}
                />
              );
            }}
          </For>
        </div>
        <div class="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span class="inline-flex items-center gap-1.5">
            <span class="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            {t('attachments.voice.recording')}
          </span>
          <span class="font-mono tabular-nums">
            {formatMediaTime(seconds())}
            <Show when={nearCap()}>
              <span class="ms-1.5 text-destructive">({formatMediaTime(remaining())})</span>
            </Show>
          </span>
        </div>
      </div>

      <IconButton icon="fa-solid fa-xmark" label={t('attachments.voice.cancel')} onClick={() => props.onCancel()} />
    </div>
  );
};
