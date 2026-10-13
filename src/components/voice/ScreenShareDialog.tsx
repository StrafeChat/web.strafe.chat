import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js';
import { setScreenShareEnabled, voice } from '../../stores/voice';
import {
  SCREEN_SHARE_FPS,
  SCREEN_SHARE_RESOLUTIONS,
  setVoiceSettings,
  voiceSettings,
  type ScreenShareFps,
  type ScreenShareResolution,
} from '../../stores/voiceSettings';
import { Button } from '../ui/Button';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { appDialogActions, zLayer } from '../../theme/appChrome';
import { desktopShell } from '../../desktop/env';
import { chooseScreenShareSource, screenShareSources, type ScreenSource } from '../../desktop/native';
import { t } from '../../i18n';

const [open, setOpen] = createSignal(false);

/**
 * Ask for the quality, then share. The browser's own "choose what to share" dialog has no
 * quality controls and cannot be extended, so this comes first - the same order Discord
 * ends up in, for the same reason. Where nobody else asks what to share (the Linux app on
 * X11, where Chromium leaves it to the app), this dialog asks that too.
 */
export function openScreenShareDialog(): void {
  setOpen(true);
}

export function closeScreenShareDialog(): void {
  setOpen(false);
}

const optionRow =
  'flex-1 rounded-lg border px-3 py-2 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const optionOn = 'border-primary bg-primary/15 text-foreground';
const optionOff = 'border-border/70 bg-background/40 text-muted-foreground hover:bg-muted/30';
const sourceTile =
  'flex min-w-0 flex-col gap-1.5 rounded-lg border p-1.5 text-start text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** One kind of source (screens, or windows) as a grid of previews to pick from. */
const SourceGroup: Component<{
  label: string;
  sources: ScreenSource[];
  chosen: string | null;
  disabled: boolean;
  onChoose: (id: string) => void;
}> = (props) => (
  <Show when={props.sources.length > 0}>
    <div role="group" aria-label={props.label}>
      <p class="mb-1.5 text-xs font-medium text-muted-foreground">{props.label}</p>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <For each={props.sources}>
          {(source) => (
            <button
              type="button"
              class={`${sourceTile} ${props.chosen === source.id ? optionOn : optionOff}`}
              aria-pressed={props.chosen === source.id}
              title={source.name}
              disabled={props.disabled}
              onClick={() => props.onChoose(source.id)}
            >
              <span class="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-black">
                <Show
                  when={source.thumbnail}
                  fallback={
                    <i
                      class={`fa-solid ${source.kind === 'screen' ? 'fa-display' : 'fa-window-maximize'} text-lg text-white/40`}
                      aria-hidden="true"
                    />
                  }
                >
                  <img src={source.thumbnail} alt="" class="size-full object-contain" draggable={false} />
                </Show>
              </span>
              <span class="flex w-full min-w-0 items-center gap-1.5 px-0.5">
                <Show when={source.appIcon}>
                  {(icon) => <img src={icon()} alt="" class="size-3.5 shrink-0" draggable={false} />}
                </Show>
                <span class="truncate">{source.name}</span>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  </Show>
);

export const ScreenShareDialog: Component = () => {
  const [busy, setBusy] = createSignal(false);
  const resolution = () => voiceSettings.screenShareResolution;
  const fps = () => voiceSettings.screenShareFps;
  // A memo, so moving between connecting, connected and reconnecting while the dialog is open
  // is not an open/close: the source list and the choice stay put.
  const shown = createMemo(() => open() && voice.session.status !== 'idle');
  // A dialog left open when the call ended is closed with it. Merely hidden, it came back on
  // its own during the next call's connecting phase.
  createEffect(() => {
    if (open() && voice.session.status === 'idle') setOpen(false);
  });

  // The app's own picker, for when the Electron shell leaves the choice to us (X11). On
  // Wayland the desktop portal asks instead, and a browser or the Tauri app shows the
  // system's picker, so there it stays null. undefined while the shell is looking.
  const [sources, setSources] = createSignal<ScreenSource[] | null | undefined>(null);
  const [chosen, setChosen] = createSignal<string | null>(null);
  const [chooseFailed, setChooseFailed] = createSignal(false);
  const picking = () => sources() !== null;
  const screens = () => sources()?.filter((s) => s.kind === 'screen') ?? [];
  const windows = () => sources()?.filter((s) => s.kind === 'window') ?? [];

  // A fresh list each time the dialog opens: windows come and go between shares. A list that
  // arrives after the dialog was closed (or reopened) is dropped. Closing leaves the last one
  // in place, so the copy of the dialog that animates out keeps its width and contents.
  let lookup = 0;
  createEffect(
    on(shown, (isShown) => {
      const n = ++lookup;
      if (!isShown || desktopShell() !== 'electron') return;
      setChosen(null);
      setChooseFailed(false);
      setSources(undefined);
      screenShareSources()
        .then((list) => {
          if (n !== lookup) return;
          // Nothing preselected: a whole screen shows everything on it, notifications and all,
          // so what gets broadcast is always picked on purpose.
          setSources(list);
        })
        .catch((e) => {
          console.warn('[voice] screen share sources', e);
          if (n === lookup) setSources([]);
        });
    }),
  );

  function choose(id: string) {
    setChosen(id);
    setChooseFailed(false);
  }

  const resolutionLabel = (r: ScreenShareResolution) =>
    r === 'source' ? t('voice.screenShare.source') : t('voice.screenShare.resolutionValue', { height: r });

  async function share() {
    if (busy()) return;
    const source = chosen();
    if (picking() && !source) return;
    setBusy(true);
    setChooseFailed(false);
    try {
      // The shell has to know what to hand over before the capture is asked for.
      if (source) {
        try {
          await chooseScreenShareSource(source);
        } catch (e) {
          console.warn('[voice] screen share source', e);
          setChooseFailed(true);
          return;
        }
      }
      // The choice is remembered as the default for next time, which is why it is written
      // to settings rather than only passed through.
      await setScreenShareEnabled(true, { resolution: resolution(), fps: fps() });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={shown()}>
      <ResponsiveDialog
        size={picking() ? 'lg' : 'sm'}
        zClass={zLayer.modal}
        onClose={() => !busy() && setOpen(false)}
        dismissible={!busy()}
        title={t('voice.screenShare.title')}
        description={t('voice.screenShare.description')}
      >
        <div class="space-y-4">
          <Show when={picking()}>
            <div>
              <p class="mb-1.5 text-sm font-medium text-foreground">{t('voice.screenShare.whatToShare')}</p>
              <Show
                when={sources()}
                fallback={
                  <p class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                    <i class="fa-solid fa-circle-notch animate-spin" aria-hidden="true" />
                    {t('voice.screenShare.loadingSources')}
                  </p>
                }
              >
                {(list) => (
                  <Show
                    when={list().length > 0}
                    fallback={<p class="py-8 text-center text-sm text-muted-foreground">{t('voice.screenShare.noSources')}</p>}
                  >
                    {/* Its own scroll, so a desktop full of windows never pushes the quality
                        options and the Share button out of reach. */}
                    <div class="max-h-[min(22rem,45vh)] space-y-3 overflow-y-auto overscroll-contain pe-1">
                      <SourceGroup
                        label={t('voice.screenShare.screens')}
                        sources={screens()}
                        chosen={chosen()}
                        disabled={busy()}
                        onChoose={choose}
                      />
                      <SourceGroup
                        label={t('voice.screenShare.windows')}
                        sources={windows()}
                        chosen={chosen()}
                        disabled={busy()}
                        onChoose={choose}
                      />
                    </div>
                  </Show>
                )}
              </Show>
            </div>
          </Show>
          <div>
            <p class="mb-1.5 text-sm font-medium text-foreground">{t('voice.screenShare.resolution')}</p>
            <div class="flex gap-2">
              <For each={SCREEN_SHARE_RESOLUTIONS}>
                {(r) => (
                  <button
                    type="button"
                    class={`${optionRow} ${resolution() === r ? optionOn : optionOff}`}
                    aria-pressed={resolution() === r}
                    disabled={busy()}
                    onClick={() => setVoiceSettings({ screenShareResolution: r })}
                  >
                    {resolutionLabel(r)}
                  </button>
                )}
              </For>
            </div>
          </div>
          <div>
            <p class="mb-1.5 text-sm font-medium text-foreground">{t('voice.screenShare.frameRate')}</p>
            <div class="flex gap-2">
              <For each={SCREEN_SHARE_FPS}>
                {(f: ScreenShareFps) => (
                  <button
                    type="button"
                    class={`${optionRow} ${fps() === f ? optionOn : optionOff}`}
                    aria-pressed={fps() === f}
                    disabled={busy()}
                    onClick={() => setVoiceSettings({ screenShareFps: f })}
                  >
                    {t('voice.screenShare.fpsValue', { fps: f })}
                  </button>
                )}
              </For>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            {fps() >= 60 ? t('voice.screenShare.hintMotion') : t('voice.screenShare.hintDetail')}
          </p>
          <Show when={chooseFailed()}>
            <p class="text-xs text-destructive" role="alert">
              {t('voice.errors.screenFailed')}
            </p>
          </Show>
          <div class={appDialogActions}>
            <Button variant="outline" disabled={busy()} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={busy()} disabled={busy() || (picking() && !chosen())} onClick={() => void share()}>
              <i class="fa-solid fa-display text-xs" aria-hidden="true" />
              {t('voice.shareScreen')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
