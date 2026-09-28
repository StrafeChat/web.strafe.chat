import type { Component } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
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
import { t } from '../../i18n';

const [open, setOpen] = createSignal(false);

/**
 * Ask for the quality, then share. The browser's own "choose what to share" dialog has no
 * quality controls and cannot be extended, so this comes first - the same order Discord
 * ends up in, for the same reason.
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

export const ScreenShareDialog: Component = () => {
  const [busy, setBusy] = createSignal(false);
  const resolution = () => voiceSettings.screenShareResolution;
  const fps = () => voiceSettings.screenShareFps;

  const resolutionLabel = (r: ScreenShareResolution) =>
    r === 'source' ? t('voice.screenShare.source') : t('voice.screenShare.resolutionValue', { height: r });

  async function share() {
    if (busy()) return;
    setBusy(true);
    try {
      // The choice is remembered as the default for next time, which is why it is written
      // to settings rather than only passed through.
      await setScreenShareEnabled(true, { resolution: resolution(), fps: fps() });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={open() && voice.session.status !== 'idle'}>
      <ResponsiveDialog
        size="sm"
        zClass={zLayer.modal}
        onClose={() => !busy() && setOpen(false)}
        dismissible={!busy()}
        title={t('voice.screenShare.title')}
        description={t('voice.screenShare.description')}
      >
        <div class="space-y-4">
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
          <div class={appDialogActions}>
            <Button variant="outline" disabled={busy()} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={busy()} disabled={busy()} onClick={() => void share()}>
              <i class="fa-solid fa-display text-xs" aria-hidden="true" />
              {t('voice.shareScreen')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </Show>
  );
};
