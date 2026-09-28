import type { Component, JSX } from 'solid-js';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import {
  audioConstraints,
  setVoiceSettings,
  videoConstraints,
  voiceSettings,
  SCREEN_SHARE_FPS,
  SCREEN_SHARE_RESOLUTIONS,
  type NoiseSuppressionMode,
  type ScreenShareFps,
  type ScreenShareResolution,
} from '../../stores/voiceSettings';
import { comboFromEvent, comboParts } from '../../stores/keybinds';
import { onInputModeChanged } from '../../stores/voice';
import { createMicPipeline, type MicPipeline } from '../../lib/voice/micPipeline';
import { Button } from '../ui/Button';
import { RangeField } from '../ui/RangeField';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Tabs } from '../ui/Tabs';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { t } from '../../i18n';

const Row: Component<{ icon: string; title: string; description: string; control: JSX.Element }> = (props) => (
  <div class={settingsRowShell}>
    <div class={settingsRowIcon}>
      <i class={`fa-solid ${props.icon} text-sm`} aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-semibold text-foreground">{props.title}</p>
      <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{props.description}</p>
    </div>
    <div class="shrink-0">{props.control}</div>
  </div>
);

interface DeviceLists {
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
}

function deviceLabel(d: MediaDeviceInfo, fallback: string): string {
  return d.label || `${fallback} ${d.deviceId.slice(0, 6)}`;
}

/** User settings → Voice & video: devices, levels, processing, mic test and camera preview. */
export const VoiceVideoSettingsPage: Component = () => {
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.enumerateDevices;
  const [devices, setDevices] = createSignal<DeviceLists>({ inputs: [], outputs: [], cameras: [] });
  const [labelsKnown, setLabelsKnown] = createSignal(false);
  const [permError, setPermError] = createSignal('');
  const [micLevel, setMicLevel] = createSignal(0);
  const [micTesting, setMicTesting] = createSignal(false);
  const [cameraOn, setCameraOn] = createSignal(false);
  /** The same pipeline a call uses, so the meter shows what others would hear. */
  let mic: MicPipeline | null = null;
  let camStream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | undefined;

  async function enumerate() {
    if (!supported) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        inputs: all.filter((d) => d.kind === 'audioinput'),
        outputs: all.filter((d) => d.kind === 'audiooutput'),
        cameras: all.filter((d) => d.kind === 'videoinput'),
      });
      setLabelsKnown(all.some((d) => d.label));
    } catch {
      /* ignore */
    }
  }

  onMount(() => {
    void enumerate();
    navigator.mediaDevices?.addEventListener?.('devicechange', enumerate);
  });

  onCleanup(() => {
    navigator.mediaDevices?.removeEventListener?.('devicechange', enumerate);
    stopMic();
    stopCamera();
  });

  /** Ask once for audio (and video) so the browser reveals device names. */
  async function requestAccess(video: boolean) {
    setPermError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      s.getTracks().forEach((tr) => tr.stop());
      await enumerate();
    } catch (e) {
      setPermError(e instanceof Error && e.name === 'NotAllowedError' ? t('settings.voice.permDenied') : t('settings.voice.permFailed'));
    }
  }

  function stopMic() {
    mic?.close();
    mic = null;
    setMicTesting(false);
    setMicLevel(0);
  }

  async function startMic() {
    setPermError('');
    try {
      const pipeline = await createMicPipeline({
        constraints: audioConstraints(),
        inputGain: voiceSettings.inputVolume / 100,
        noiseSuppression: voiceSettings.noiseSuppression,
        // Map -60..0 dBFS onto 0..100.
        onLevel: (db) => setMicLevel(Math.max(0, Math.min(100, ((db + 60) / 60) * 100))),
      });
      if (mic) {
        // Two clicks raced; keep the first.
        pipeline.close();
        return;
      }
      mic = pipeline;
      setMicTesting(true);
      await enumerate();
    } catch (e) {
      stopMic();
      setPermError(e instanceof Error && e.name === 'NotAllowedError' ? t('settings.voice.permDenied') : t('settings.voice.micFailed'));
    }
  }

  // A processing change while the test runs rebuilds the test pipeline, as it does a call.
  createEffect(
    on(
      () => [voiceSettings.inputDeviceId, voiceSettings.noiseSuppression, voiceSettings.echoCancellation, voiceSettings.autoGainControl] as const,
      () => {
        if (!micTesting()) return;
        stopMic();
        void startMic();
      },
      { defer: true }
    )
  );
  createEffect(() => {
    mic?.setInputGain(voiceSettings.inputVolume / 100);
  });

  function stopCamera() {
    camStream?.getTracks().forEach((tr) => tr.stop());
    camStream = null;
    if (videoEl) videoEl.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    setPermError('');
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints() });
      if (videoEl) {
        videoEl.srcObject = camStream;
        await videoEl.play().catch(() => undefined);
      }
      setCameraOn(true);
      await enumerate();
    } catch (e) {
      stopCamera();
      setPermError(e instanceof Error && e.name === 'NotAllowedError' ? t('settings.voice.permDenied') : t('settings.voice.cameraFailed'));
    }
  }

  const thresholdPct = () => Math.max(0, Math.min(100, ((voiceSettings.sensitivityDb + 60) / 60) * 100));
  const speaking = () => micTesting() && (voiceSettings.autoSensitivity ? micLevel() > 25 : micLevel() > thresholdPct());

  const [recordingPtt, setRecordingPtt] = createSignal(false);
  function onRecordPtt(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setRecordingPtt(false);
      return;
    }
    const combo = comboFromEvent(e);
    if (!combo) return;
    setVoiceSettings({ pttKey: combo });
    setRecordingPtt(false);
  }
  function setInputMode(mode: 'vad' | 'ptt') {
    setVoiceSettings({ inputMode: mode });
    onInputModeChanged();
  }

  return (
    <div class="max-w-3xl space-y-8">
      <Show when={!supported}>
        <p class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">{t('settings.voice.unsupported')}</p>
      </Show>
      <Show when={permError()}>
        <p class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{permError()}</p>
      </Show>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class={settingsSectionTitle}>{t('settings.voice.devicesTitle')}</h3>
          <Show when={supported && !labelsKnown()}>
            <Button size="sm" variant="outline" onClick={() => void requestAccess(false)}>
              <i class="fa-solid fa-unlock text-xs" aria-hidden="true" />
              {t('settings.voice.allowAccess')}
            </Button>
          </Show>
        </div>
        <div class={`grid gap-4 sm:grid-cols-2 ${settingsGroupFrame}`}>
          <Select
            label={t('settings.voice.inputDevice')}
            value={voiceSettings.inputDeviceId}
            disabled={!supported}
            onValueChange={(v) => setVoiceSettings({ inputDeviceId: v })}
          >
            <option value="">{t('settings.voice.defaultDevice')}</option>
            <For each={devices().inputs}>{(d) => <option value={d.deviceId}>{deviceLabel(d, t('settings.voice.microphone'))}</option>}</For>
          </Select>
          <Select
            label={t('settings.voice.outputDevice')}
            value={voiceSettings.outputDeviceId}
            disabled={!supported}
            onValueChange={(v) => setVoiceSettings({ outputDeviceId: v })}
          >
            <option value="">{t('settings.voice.defaultDevice')}</option>
            <For each={devices().outputs}>{(d) => <option value={d.deviceId}>{deviceLabel(d, t('settings.voice.speaker'))}</option>}</For>
          </Select>
          <RangeField
            label={t('settings.voice.inputVolume')}
            min={0}
            max={200}
            value={voiceSettings.inputVolume}
            valueLabel={`${voiceSettings.inputVolume}%`}
            onChange={(v) => setVoiceSettings({ inputVolume: v })}
          />
          <RangeField
            label={t('settings.voice.outputVolume')}
            min={0}
            max={200}
            value={voiceSettings.outputVolume}
            valueLabel={`${voiceSettings.outputVolume}%`}
            onChange={(v) => setVoiceSettings({ outputVolume: v })}
          />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.micTestTitle')}</h3>
        <div class={`space-y-3 ${settingsGroupFrame}`}>
          <p class="text-xs text-muted-foreground">{t('settings.voice.micTestHint')}</p>
          <div class="flex items-center gap-3">
            <Button size="sm" variant={micTesting() ? 'destructive' : 'outline'} disabled={!supported} onClick={() => (micTesting() ? stopMic() : void startMic())}>
              <i class={`fa-solid ${micTesting() ? 'fa-stop' : 'fa-microphone'} text-xs`} aria-hidden="true" />
              {micTesting() ? t('settings.voice.stopTest') : t('settings.voice.startTest')}
            </Button>
            <div class="relative h-3 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(micLevel())} aria-label={t('settings.voice.level')}>
              <div class={`h-full rounded-full transition-[width] duration-75 ${speaking() ? 'bg-emerald-500' : 'bg-primary/60'}`} style={{ width: `${micLevel()}%` }} />
              <Show when={!voiceSettings.autoSensitivity}>
                <div class="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${thresholdPct()}%` }} aria-hidden="true" />
              </Show>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.inputModeTitle')}</h3>
        <div class={`space-y-4 ${settingsGroupFrame}`}>
          <Tabs
            size="sm"
            aria-label={t('settings.voice.inputModeTitle')}
            value={voiceSettings.inputMode}
            onChange={(v) => setInputMode(v)}
            items={[
              { id: 'vad', label: t('settings.voice.modeVad') },
              { id: 'ptt', label: t('settings.voice.modePtt') },
            ]}
          />
          <p class="text-xs text-muted-foreground">
            {voiceSettings.inputMode === 'ptt' ? t('settings.voice.modePttHint') : t('settings.voice.modeVadHint')}
          </p>
          <Show when={voiceSettings.inputMode === 'ptt'}>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm font-medium text-foreground">{t('settings.voice.pttKey')}</span>
              <button
                type="button"
                class={`min-w-[8rem] rounded-lg border px-3 py-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  recordingPtt() ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/40 hover:bg-muted/30'
                }`}
                aria-label={t('settings.voice.pttKey')}
                onClick={() => setRecordingPtt((r) => !r)}
                onKeyDown={(e) => recordingPtt() && onRecordPtt(e)}
                onBlur={() => setRecordingPtt(false)}
              >
                <Show when={!recordingPtt()} fallback={<span class="text-xs text-primary">{t('settings.keybinds.pressKeys')}</span>}>
                  <span class="inline-flex items-center gap-1" dir="ltr">
                    <Show when={voiceSettings.pttKey} fallback={<span class="text-xs text-muted-foreground">{t('settings.keybinds.unbound')}</span>}>
                      <For each={comboParts(voiceSettings.pttKey)}>
                        {(part, i) => (
                          <>
                            <Show when={i() > 0}>
                              <span class="text-[10px] text-muted-foreground">+</span>
                            </Show>
                            <kbd class="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{part}</kbd>
                          </>
                        )}
                      </For>
                    </Show>
                  </span>
                </Show>
              </button>
              <span class="text-xs text-muted-foreground">{t('settings.voice.pttKeyHint')}</span>
            </div>
            <RangeField
              label={t('settings.voice.pttRelease')}
              min={0}
              max={2000}
              step={50}
              value={voiceSettings.pttReleaseMs}
              valueLabel={`${voiceSettings.pttReleaseMs} ms`}
              onChange={(v) => setVoiceSettings({ pttReleaseMs: v })}
            />
          </Show>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.sensitivityTitle')}</h3>
        <div class="space-y-2">
          <Row
            icon="fa-wand-magic-sparkles"
            title={t('settings.voice.autoSensitivity')}
            description={t('settings.voice.autoSensitivityHint')}
            control={<Toggle checked={voiceSettings.autoSensitivity} onChange={(on) => setVoiceSettings({ autoSensitivity: on })} />}
          />
          <div class={settingsGroupFrame}>
            <RangeField
              label={t('settings.voice.threshold')}
              min={-100}
              max={0}
              value={voiceSettings.sensitivityDb}
              valueLabel={`${voiceSettings.sensitivityDb} dB`}
              disabled={voiceSettings.autoSensitivity}
              onChange={(v) => setVoiceSettings({ sensitivityDb: v })}
            />
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.processingTitle')}</h3>
        <div class="space-y-2">
          <Row
            icon="fa-arrows-rotate"
            title={t('settings.voice.echo')}
            description={t('settings.voice.echoHint')}
            control={<Toggle checked={voiceSettings.echoCancellation} onChange={(on) => setVoiceSettings({ echoCancellation: on })} />}
          />
          <Row
            icon="fa-wind"
            title={t('settings.voice.noise')}
            description={t('settings.voice.noiseHint')}
            control={
              <div class="w-44">
                <Select
                  aria-label={t('settings.voice.noise')}
                  value={voiceSettings.noiseSuppression}
                  onValueChange={(v) => setVoiceSettings({ noiseSuppression: v as NoiseSuppressionMode })}
                >
                  <option value="rnnoise">{t('settings.voice.noiseMode.rnnoise')}</option>
                  <option value="browser">{t('settings.voice.noiseMode.browser')}</option>
                  <option value="off">{t('settings.voice.noiseMode.off')}</option>
                </Select>
              </div>
            }
          />
          <Row
            icon="fa-gauge-high"
            title={t('settings.voice.gain')}
            description={t('settings.voice.gainHint')}
            control={<Toggle checked={voiceSettings.autoGainControl} onChange={(on) => setVoiceSettings({ autoGainControl: on })} />}
          />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.screenShareTitle')}</h3>
        <div class={`grid gap-4 sm:grid-cols-2 ${settingsGroupFrame}`}>
          <Select
            label={t('voice.screenShare.resolution')}
            value={voiceSettings.screenShareResolution}
            onValueChange={(v) => setVoiceSettings({ screenShareResolution: v as ScreenShareResolution })}
          >
            <For each={SCREEN_SHARE_RESOLUTIONS}>
              {(r) => (
                <option value={r}>
                  {r === 'source' ? t('voice.screenShare.source') : t('voice.screenShare.resolutionValue', { height: r })}
                </option>
              )}
            </For>
          </Select>
          <Select
            label={t('voice.screenShare.frameRate')}
            value={String(voiceSettings.screenShareFps)}
            onValueChange={(v) => setVoiceSettings({ screenShareFps: Number(v) as ScreenShareFps })}
          >
            <For each={SCREEN_SHARE_FPS}>{(f) => <option value={String(f)}>{t('voice.screenShare.fpsValue', { fps: f })}</option>}</For>
          </Select>
          <p class="text-xs text-muted-foreground sm:col-span-2">{t('settings.voice.screenShareHint')}</p>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.voice.videoTitle')}</h3>
        <Row
          icon="fa-left-right"
          title={t('settings.voice.mirror')}
          description={t('settings.voice.mirrorHint')}
          control={<Toggle checked={voiceSettings.mirrorCamera} onChange={(on) => setVoiceSettings({ mirrorCamera: on })} />}
        />
        <div class={`space-y-4 ${settingsGroupFrame}`}>
          <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label={t('settings.voice.camera')}
              value={voiceSettings.cameraDeviceId}
              disabled={!supported}
              onValueChange={(v) => {
                setVoiceSettings({ cameraDeviceId: v });
                if (cameraOn()) {
                  stopCamera();
                  void startCamera();
                }
              }}
            >
              <option value="">{t('settings.voice.defaultDevice')}</option>
              <For each={devices().cameras}>{(d) => <option value={d.deviceId}>{deviceLabel(d, t('settings.voice.cameraFallback'))}</option>}</For>
            </Select>
            <Button size="sm" variant={cameraOn() ? 'destructive' : 'outline'} class="h-10" disabled={!supported} onClick={() => (cameraOn() ? stopCamera() : void startCamera())}>
              <i class={`fa-solid ${cameraOn() ? 'fa-video-slash' : 'fa-video'} text-xs`} aria-hidden="true" />
              {cameraOn() ? t('settings.voice.stopPreview') : t('settings.voice.testVideo')}
            </Button>
          </div>
          <div class={`aspect-video w-full max-w-md overflow-hidden rounded-xl border border-border bg-black/60 ${cameraOn() ? '' : 'flex items-center justify-center'}`}>
            <video
              ref={(el) => {
                videoEl = el;
              }}
              class={`size-full object-cover ${cameraOn() ? '' : 'hidden'}`}
              muted
              playsinline
              autoplay
            />
            <Show when={!cameraOn()}>
              <p class="text-xs text-muted-foreground">{t('settings.voice.previewOff')}</p>
            </Show>
          </div>
        </div>
      </section>
    </div>
  );
};
