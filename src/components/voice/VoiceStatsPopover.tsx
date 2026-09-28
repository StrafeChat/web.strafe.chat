import type { Component } from 'solid-js';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { readVoiceStats, voice, voiceStatesForRoom } from '../../stores/voice';
import { voiceSettings } from '../../stores/voiceSettings';
import { voiceParticipantName } from '../../lib/voice/perms';
import { userIdOfIdentity } from '../../lib/e2ee/callKeys';
import type { AudioStreamStats, VideoStreamStats, VoiceStatsSnapshot } from '../../lib/voice/stats';
import { appMenuPanel, zLayer } from '../../theme/appChrome';
import { t } from '../../i18n';

const EDGE = 8;
const GAP = 8;
const REFRESH_MS = 1000;

const [anchor, setAnchor] = createSignal<HTMLElement | null>(null);

/** Toggle the statistics popover next to `el` (closes when opened from the same element). */
export function toggleVoiceStats(el: HTMLElement): void {
  setAnchor((cur) => (cur === el ? null : el));
}

export function closeVoiceStats(): void {
  setAnchor(null);
}

function fmtPct(v: number): string {
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
}

/**
 * Discord's "voice connection info": how the media travels, round trip, what we send,
 * and per person how much of their audio and video arrived intact. Loss and concealment
 * at zero with audio that still sounds bad means the problem is acoustic, not the network.
 */
export const VoiceStatsPopover: Component = () => {
  let panel: HTMLDivElement | undefined;
  const [pos, setPos] = createSignal<{ left: number; top: number } | null>(null);
  const [snap, setSnap] = createSignal<VoiceStatsSnapshot | null>(null);

  function place() {
    const el = anchor();
    if (!el || !panel) return;
    const r = el.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    // Above the anchor when it fits (the dock sits at the bottom), else below.
    const above = r.top - h - GAP;
    const top = above >= EDGE ? above : Math.min(r.bottom + GAP, Math.max(EDGE, window.innerHeight - h - EDGE));
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE));
    setPos({ left, top });
  }

  createEffect(() => {
    if (!anchor()) {
      setPos(null);
      setSnap(null);
      return;
    }
    setPos(null);
    requestAnimationFrame(place);
    const tick = () => {
      void readVoiceStats().then((s) => {
        if (!anchor()) return;
        setSnap(s);
        // The panel grows once the first reading replaces "measuring": place it again
        // or it keeps the spot measured for the short version and runs off the bottom.
        requestAnimationFrame(place);
      });
    };
    tick();
    const timer = window.setInterval(tick, REFRESH_MS);
    const onDocClick = (e: MouseEvent) => {
      if (panel?.contains(e.target as Node) || anchor()?.contains(e.target as Node)) return;
      closeVoiceStats();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeVoiceStats();
    };
    document.addEventListener('mousedown', onDocClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    onCleanup(() => {
      window.clearInterval(timer);
      document.removeEventListener('mousedown', onDocClick, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    });
  });

  // Hanging up closes it.
  createEffect(() => {
    if (voice.session.status === 'idle') closeVoiceStats();
  });

  const nameOf = (identity: string) => {
    const uid = userIdOfIdentity(identity);
    const rid = voice.session.roomId ?? '';
    return voiceParticipantName(uid, voiceStatesForRoom(rid).find((s) => s.user_id === uid), voice.session.spaceId ?? undefined);
  };
  const transportText = (s: VoiceStatsSnapshot) => {
    if (!s.transport) return '…';
    const proto = s.transport.protocol ? s.transport.protocol.toUpperCase() : '…';
    return s.transport.relay ? `${proto} · ${t('voice.stats.relay')}` : proto;
  };
  const noiseText = () => {
    switch (voiceSettings.noiseSuppression) {
      case 'rnnoise':
        return t('settings.voice.noiseMode.rnnoise');
      case 'browser':
        return t('settings.voice.noiseMode.browser');
      default:
        return t('settings.voice.noiseMode.off');
    }
  };

  const Audio: Component<{ stats: AudioStreamStats }> = (props) => (
    <span class="tabular-nums text-muted-foreground">
      {t('voice.stats.loss')} {fmtPct(props.stats.lossPct)} · {t('voice.stats.jitter')} {props.stats.jitterMs} ms · {t('voice.stats.concealed')}{' '}
      {fmtPct(props.stats.concealedPct)} · {props.stats.kbps} kbps
    </span>
  );
  const Video: Component<{ stats: VideoStreamStats; label: string }> = (props) => (
    <span class="tabular-nums text-muted-foreground">
      {props.label} {props.stats.width}×{props.stats.height} · {props.stats.fps} fps · {t('voice.stats.loss')} {fmtPct(props.stats.lossPct)} ·{' '}
      {props.stats.kbps} kbps
    </span>
  );

  return (
    <Show when={anchor()}>
      <Portal mount={document.body}>
        <div
          ref={(el) => {
            panel = el;
          }}
          id="voice-stats-popover"
          role="dialog"
          aria-label={t('voice.stats.title')}
          class={`fixed ${zLayer.popover} w-80 max-w-[calc(100vw-1rem)] ${appMenuPanel} px-3 py-2 text-xs`}
          style={{
            left: `${pos()?.left ?? -9999}px`,
            top: `${pos()?.top ?? -9999}px`,
            visibility: pos() ? 'visible' : 'hidden',
          }}
          data-voice-stats
        >
          <div class="mb-1.5 text-sm font-semibold text-foreground">{t('voice.stats.title')}</div>
          <Show when={snap()} fallback={<p class="text-muted-foreground">{t('voice.stats.measuring')}</p>}>
            {(s) => (
              <div class="space-y-2">
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
                  <dt class="text-muted-foreground">{t('voice.stats.transport')}</dt>
                  <dd class="text-foreground">{transportText(s())}</dd>
                  <dt class="text-muted-foreground">{t('voice.stats.rtt')}</dt>
                  <dd class="text-foreground">{s().rttMs !== undefined ? `${s().rttMs} ms` : '…'}</dd>
                  <dt class="text-muted-foreground">{t('voice.stats.sending')}</dt>
                  <dd class="text-foreground">
                    {s().outbound ? `${s().outbound!.kbps} kbps · ${t('voice.stats.loss')} ${fmtPct(s().outbound!.lossPct)}` : t('voice.stats.nothing')}
                  </dd>
                  <dt class="text-muted-foreground">{t('voice.stats.noise')}</dt>
                  <dd class="text-foreground">{noiseText()}</dd>
                  <dt class="text-muted-foreground">{t('voice.stats.quality')}</dt>
                  <dd class="text-foreground">{t(`voice.quality.${voice.session.quality}`)}</dd>
                </dl>
                <Show when={s().participants.length > 0} fallback={<p class="text-muted-foreground">{t('voice.stats.alone')}</p>}>
                  <ul class="space-y-1.5 border-t border-border/60 pt-1.5">
                    <For each={s().participants}>
                      {(p) => (
                        <li class="flex flex-col gap-0.5">
                          <span class="truncate font-medium text-foreground">{nameOf(p.identity)}</span>
                          <Show when={p.microphone} fallback={<span class="text-muted-foreground">{t('voice.stats.noAudio')}</span>}>
                            {(a) => <Audio stats={a()} />}
                          </Show>
                          <Show when={p.camera}>{(v) => <Video stats={v()} label={t('voice.stats.camera')} />}</Show>
                          <Show when={p.screen}>{(v) => <Video stats={v()} label={t('voice.stats.screen')} />}</Show>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </Portal>
    </Show>
  );
};
