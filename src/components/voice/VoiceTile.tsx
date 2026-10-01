import type { Component } from 'solid-js';
import { createEffect, createMemo, onCleanup, Show } from 'solid-js';
import type { VoiceState } from '../../api/voice';
import { trackFor, voice } from '../../stores/voice';
import { voiceSettings } from '../../stores/voiceSettings';
import { MessageAvatar } from '../messageList/MessageAvatar';
import { Tooltip } from '../ui/Tooltip';
import { t } from '../../i18n';

export interface VoiceTileProps {
  state: VoiceState;
  name: string;
  avatar?: string;
  /** A participant's own tile (camera or avatar) or their shared screen. */
  kind: 'user' | 'screen';
  isLocal: boolean;
  /** Spotlighted: fills the stage, others move to the strip. */
  focused?: boolean;
  /** Rendered in the small strip beside the spotlight. */
  compact?: boolean;
  /** Exact size from the stage's layout (see VoiceStage); the strip sizes itself. */
  width?: number;
  height?: number;
  onClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
}

/**
 * One tile on the voice stage. Video tracks are attached straight to the element by
 * LiveKit; everything else (name, mute / deafen / camera badges, the speaking ring)
 * comes from the server's voice state.
 */
export const VoiceTile: Component<VoiceTileProps> = (props) => {
  let videoEl: HTMLVideoElement | undefined;
  const media = () => voice.media[props.state.user_id];
  const sid = () => (props.kind === 'screen' ? media()?.screen : media()?.camera);
  // A memo, so the attach effect below only re-runs when the Track object itself
  // changes: any other store write would detach and re-attach the element, and under
  // adaptive stream that pauses and restarts the subscription on the server.
  const track = createMemo(() => trackFor(sid()));
  const speaking = () => props.kind === 'user' && !!voice.speaking[props.state.user_id];
  const mirrored = () => props.kind === 'user' && props.isLocal && voiceSettings.mirrorCamera;

  createEffect(() => {
    const tr = track();
    const el = videoEl;
    if (!tr || !el) return;
    tr.attach(el);
    onCleanup(() => {
      tr.detach(el);
    });
  });

  const muted = () => props.state.self_mute || props.state.mute;
  const deafened = () => props.state.self_deaf || props.state.deaf;

  return (
    <div
      role={props.onClick ? 'button' : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      class={`group relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/55 ring-2 transition-[box-shadow,ring-color] duration-150 ${
        speaking() ? 'ring-emerald-400' : props.focused ? 'ring-primary/60' : 'ring-transparent'
      } ${props.compact ? 'h-24 w-40' : ''} ${props.onClick ? 'cursor-pointer' : ''}`}
      style={props.compact ? undefined : { width: `${props.width ?? 0}px`, height: `${props.height ?? 0}px` }}
      onClick={() => props.onClick?.()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && props.onClick) {
          e.preventDefault();
          props.onClick();
        }
      }}
      onContextMenu={(e) => props.onContextMenu?.(e)}
      data-voice-tile={`${props.state.user_id}${props.kind === 'screen' ? ':screen' : ''}`}
    >
      <video
        ref={(el) => {
          videoEl = el;
        }}
        class={`size-full ${props.kind === 'screen' ? 'object-contain' : 'object-cover'} ${track() ? '' : 'hidden'} ${
          mirrored() ? '[transform:scaleX(-1)]' : ''
        }`}
        autoplay
        playsinline
        muted
      />
      <Show when={!track()}>
        <Show
          when={props.kind === 'user'}
          fallback={
            <div class="flex flex-col items-center gap-2 text-muted-foreground">
              <i class="fa-solid fa-display text-2xl" aria-hidden="true" />
              <span class="text-xs">{t('voice.streamLoading')}</span>
            </div>
          }
        >
          <MessageAvatar
            name={props.name}
            avatar={props.avatar}
            class={`${props.compact ? 'size-12 text-lg' : props.focused ? 'size-32 text-4xl' : 'size-20 text-2xl'} ring-0`}
          />
        </Show>
      </Show>

      {/* Name chip */}
      <div class="pointer-events-none absolute bottom-2 start-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
        <Show when={props.kind === 'screen'}>
          <i class="fa-solid fa-display text-[10px]" aria-hidden="true" />
        </Show>
        <span class="truncate">{props.kind === 'screen' ? t('voice.screenOf', { name: props.name }) : props.name}</span>
        <Show when={props.isLocal && props.kind === 'user'}>
          <span class="text-white/60">· {t('voice.you')}</span>
        </Show>
      </div>

      {/* Status badges */}
      <Show when={props.kind === 'user' && (muted() || deafened() || props.state.self_stream || props.state.priority_speaker)}>
        <div class="pointer-events-none absolute bottom-2 end-2 flex items-center gap-1">
          <Show when={props.state.priority_speaker}>
            <span class="flex size-6 items-center justify-center rounded-md bg-black/60 text-amber-300 backdrop-blur" title={t('voice.status.priority')}>
              <i class="fa-solid fa-bullhorn text-[11px]" aria-hidden="true" />
            </span>
          </Show>
          <Show when={props.state.self_stream}>
            <span class="flex size-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur" title={t('voice.status.streaming')}>
              <i class="fa-solid fa-display text-[11px]" aria-hidden="true" />
            </span>
          </Show>
          <Show when={muted()}>
            <span
              class={`flex size-6 items-center justify-center rounded-md bg-black/60 backdrop-blur ${props.state.mute ? 'text-red-400' : 'text-white'}`}
              title={props.state.mute ? t('voice.status.serverMuted') : t('voice.status.muted')}
            >
              <i class="fa-solid fa-microphone-slash text-[11px]" aria-hidden="true" />
            </span>
          </Show>
          <Show when={deafened()}>
            <span
              class={`flex size-6 items-center justify-center rounded-md bg-black/60 backdrop-blur ${props.state.deaf ? 'text-red-400' : 'text-white'}`}
              title={props.state.deaf ? t('voice.status.serverDeafened') : t('voice.status.deafened')}
            >
              <i class="fa-solid fa-volume-xmark text-[11px]" aria-hidden="true" />
            </span>
          </Show>
        </div>
      </Show>

      <Show when={props.kind === 'user' && !props.state.connected}>
        <Tooltip label={t('voice.connecting')} inline side="top">
          <span class="absolute end-2 top-2 flex size-6 items-center justify-center rounded-md bg-black/60 text-white/80 backdrop-blur">
            <span class="size-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          </span>
        </Tooltip>
      </Show>
    </div>
  );
};
