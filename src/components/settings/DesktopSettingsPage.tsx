import type { Component, JSX } from 'solid-js';
import { createSignal, onMount, Show } from 'solid-js';
import { getVersion } from '@tauri-apps/api/app';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { desktopAutostart, loadDesktopPrefs, saveDesktopPrefs, type DesktopPrefs } from '../../desktop/native';
import { checkForDesktopUpdate, desktopUpdate, installDesktopUpdate } from '../../desktop/updater';
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

/** User settings -> Desktop app: updates, start-up and what closing the window does. */
export const DesktopSettingsPage: Component = () => {
  const [prefs, setPrefs] = createSignal<DesktopPrefs | null>(null);
  // null until the shell has answered; the toggle is disabled meanwhile.
  const [autostart, setAutostart] = createSignal<boolean | null>(null);
  const [autostartError, setAutostartError] = createSignal('');
  // The shell's version (StrafeChat/desktop), not the web client's build.
  const [appVersion, setAppVersion] = createSignal(__APP_VERSION__);

  onMount(() => {
    void getVersion()
      .then(setAppVersion)
      .catch(() => undefined);
    void loadDesktopPrefs()
      .then(setPrefs)
      .catch(() => setPrefs({ closeToTray: true, startMinimized: true }));
    void desktopAutostart
      .isEnabled()
      .then(setAutostart)
      .catch(() => setAutostart(false));
  });

  async function toggleAutostart(next: boolean) {
    setAutostartError('');
    try {
      if (next) await desktopAutostart.enable();
      else await desktopAutostart.disable();
      setAutostart(next);
    } catch (e) {
      setAutostartError(t('desktop.settings.autostartFailed', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  async function savePref(patch: Partial<DesktopPrefs>) {
    const cur = prefs();
    if (!cur) return;
    const next = { ...cur, ...patch };
    setPrefs(next);
    try {
      await saveDesktopPrefs(next);
    } catch {
      setPrefs(cur);
    }
  }

  const updateText = () => {
    switch (desktopUpdate.status) {
      case 'checking':
        return t('desktop.update.checking');
      case 'upToDate':
        return t('desktop.update.upToDate');
      case 'available':
        return t('desktop.update.available', { version: desktopUpdate.version });
      case 'downloading':
        return t('desktop.update.downloading', { version: desktopUpdate.version, progress: desktopUpdate.progress });
      case 'ready':
        return t('desktop.update.ready', { version: desktopUpdate.version });
      case 'installing':
        return t('desktop.update.installing');
      case 'error':
        return t('desktop.update.failed', { error: desktopUpdate.error });
      default:
        return desktopUpdate.lastCheckedAt
          ? t('desktop.update.lastChecked', { when: new Date(desktopUpdate.lastCheckedAt).toLocaleTimeString() })
          : t('desktop.update.never');
    }
  };

  return (
    <div class="space-y-6">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('desktop.settings.updatesTitle')}</h3>
        <Row
          icon="fa-rocket"
          title={t('desktop.settings.version', { version: appVersion() })}
          description={updateText()}
          control={
            <Show
              when={desktopUpdate.status === 'ready'}
              fallback={
                <Button
                  size="sm"
                  variant="outline"
                  loading={desktopUpdate.status === 'checking' || desktopUpdate.status === 'downloading'}
                  onClick={() => void checkForDesktopUpdate()}
                >
                  {t('desktop.update.check')}
                </Button>
              }
            >
              <Button size="sm" onClick={() => void installDesktopUpdate()}>
                {t('desktop.update.restart')}
              </Button>
            </Show>
          }
        />
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('desktop.settings.startupTitle')}</h3>
        <Row
          icon="fa-power-off"
          title={t('desktop.settings.launchAtStartup')}
          description={t('desktop.settings.launchAtStartupHint')}
          control={<Toggle checked={autostart() === true} disabled={autostart() === null} label={t('desktop.settings.launchAtStartup')} onChange={(v) => void toggleAutostart(v)} />}
        />
        <Show when={autostartError()}>
          <p class="text-xs text-destructive" role="alert">
            {autostartError()}
          </p>
        </Show>
        <Row
          icon="fa-window-minimize"
          title={t('desktop.settings.startMinimized')}
          description={t('desktop.settings.startMinimizedHint')}
          control={
            <Toggle
              checked={!!prefs()?.startMinimized}
              disabled={!prefs() || autostart() !== true}
              label={t('desktop.settings.startMinimized')}
              onChange={(v) => void savePref({ startMinimized: v })}
            />
          }
        />
        <Row
          icon="fa-xmark"
          title={t('desktop.settings.closeToTray')}
          description={t('desktop.settings.closeToTrayHint')}
          control={<Toggle checked={!!prefs()?.closeToTray} disabled={!prefs()} label={t('desktop.settings.closeToTray')} onChange={(v) => void savePref({ closeToTray: v })} />}
        />
      </section>
    </div>
  );
};
