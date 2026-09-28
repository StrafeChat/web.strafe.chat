import type { Component, JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import {
  desktopPermission,
  notificationPrefs,
  playNotificationSound,
  requestDesktopPermission,
  setNotificationPrefs,
  showDesktopNotification,
  type SpaceNotifyMode,
} from '../../stores/notificationPrefs';
import { Button } from '../ui/Button';
import { RangeField } from '../ui/RangeField';
import { Toggle } from '../ui/Toggle';
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

const ModePicker: Component<{
  label: string;
  value: string;
  options: { value: string; title: string; hint: string; icon: string }[];
  onChange: (v: string) => void;
}> = (props) => (
  <div class="space-y-2">
    <p class="text-sm font-medium text-foreground">{props.label}</p>
    <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={props.label}>
      <For each={props.options}>
        {(opt) => {
          const selected = () => props.value === opt.value;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected()}
              class={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected() ? 'border-primary/60 bg-primary/10 ring-1 ring-inset ring-primary/40' : 'border-border bg-muted/20 hover:bg-muted/30'
              }`}
              onClick={() => props.onChange(opt.value)}
            >
              <i class={`fa-solid ${opt.icon} mt-0.5 w-4 text-center text-muted-foreground`} aria-hidden="true" />
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-foreground">{opt.title}</span>
                <span class="block text-xs text-muted-foreground">{opt.hint}</span>
              </span>
            </button>
          );
        }}
      </For>
    </div>
  </div>
);

/** User settings → Notifications. Stored per device. */
export const NotificationsSettingsPage: Component = () => {
  const [permission, setPermission] = createSignal(desktopPermission());
  const [tested, setTested] = createSignal(false);

  async function toggleDesktop(on: boolean) {
    if (on) {
      const p = await requestDesktopPermission();
      setPermission(p);
      setNotificationPrefs({ desktop: p === 'granted' });
    } else {
      setNotificationPrefs({ desktop: false });
    }
  }

  function test() {
    if (notificationPrefs.sounds) playNotificationSound();
    if (notificationPrefs.desktop) {
      showDesktopNotification({ title: t('settings.notifications.testTitle'), body: t('settings.notifications.testBody'), tag: 'strafe-test' });
    }
    setTested(true);
    setTimeout(() => setTested(false), 1500);
  }

  const permissionHint = () => {
    switch (permission()) {
      case 'granted':
        return t('settings.notifications.permGranted');
      case 'denied':
        return t('settings.notifications.permDenied');
      case 'unsupported':
        return t('settings.notifications.permUnsupported');
      default:
        return t('settings.notifications.permDefault');
    }
  };

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.notifications.desktopTitle')}</h3>
        <div class="space-y-2">
          <Row
            icon="fa-bell"
            title={t('settings.notifications.desktop')}
            description={permissionHint()}
            control={
              <Toggle
                checked={notificationPrefs.desktop && permission() === 'granted'}
                disabled={permission() === 'denied' || permission() === 'unsupported'}
                onChange={(on) => void toggleDesktop(on)}
              />
            }
          />
          <Row
            icon="fa-eye"
            title={t('settings.notifications.preview')}
            description={t('settings.notifications.previewHint')}
            control={<Toggle checked={notificationPrefs.preview} onChange={(on) => setNotificationPrefs({ preview: on })} />}
          />
          <Row
            icon="fa-window-maximize"
            title={t('settings.notifications.whileFocused')}
            description={t('settings.notifications.whileFocusedHint')}
            control={<Toggle checked={notificationPrefs.whileFocused} onChange={(on) => setNotificationPrefs({ whileFocused: on })} />}
          />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.notifications.soundsTitle')}</h3>
        <div class="space-y-2">
          <Row
            icon="fa-volume-high"
            title={t('settings.notifications.sounds')}
            description={t('settings.notifications.soundsHint')}
            control={<Toggle checked={notificationPrefs.sounds} onChange={(on) => setNotificationPrefs({ sounds: on })} />}
          />
          <div class={settingsGroupFrame}>
            <RangeField
              label={t('settings.notifications.volume')}
              min={0}
              max={100}
              value={Math.round(notificationPrefs.volume * 100)}
              valueLabel={`${Math.round(notificationPrefs.volume * 100)}%`}
              disabled={!notificationPrefs.sounds}
              onChange={(v) => setNotificationPrefs({ volume: v / 100 })}
            />
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <h3 class={settingsSectionTitle}>{t('settings.notifications.whenTitle')}</h3>
        <ModePicker
          label={t('settings.notifications.spaces')}
          value={notificationPrefs.spaceMode}
          onChange={(v) => setNotificationPrefs({ spaceMode: v as SpaceNotifyMode })}
          options={[
            { value: 'all', icon: 'fa-comments', title: t('settings.notifications.modeAll'), hint: t('settings.notifications.modeAllHint') },
            { value: 'mentions', icon: 'fa-at', title: t('settings.notifications.modeMentions'), hint: t('settings.notifications.modeMentionsHint') },
            { value: 'none', icon: 'fa-bell-slash', title: t('settings.notifications.modeNone'), hint: t('settings.notifications.modeNoneHint') },
          ]}
        />
        <ModePicker
          label={t('settings.notifications.pms')}
          value={notificationPrefs.pmMode}
          onChange={(v) => setNotificationPrefs({ pmMode: v === 'none' ? 'none' : 'all' })}
          options={[
            { value: 'all', icon: 'fa-comments', title: t('settings.notifications.modeAll'), hint: t('settings.notifications.pmAllHint') },
            { value: 'none', icon: 'fa-bell-slash', title: t('settings.notifications.modeNone'), hint: t('settings.notifications.modeNoneHint') },
          ]}
        />
        <p class="text-xs text-muted-foreground">{t('settings.notifications.spaceDefaultHint')}</p>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.notifications.testTitle')}</h3>
        <div class="flex items-center gap-3">
          <Button variant="outline" onClick={test} disabled={!notificationPrefs.sounds && !notificationPrefs.desktop}>
            <i class={`fa-solid ${tested() ? 'fa-check' : 'fa-play'} text-xs`} aria-hidden="true" />
            {t('settings.notifications.test')}
          </Button>
          <Show when={!notificationPrefs.sounds && !notificationPrefs.desktop}>
            <p class="text-xs text-muted-foreground">{t('settings.notifications.testDisabled')}</p>
          </Show>
        </div>
      </section>
    </div>
  );
};
