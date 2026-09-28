import type { Component, JSX } from 'solid-js';
import { Show } from 'solid-js';
import { appearance, setFontScale, setGlass, setReduceMotion, type FontScale } from '../../stores/appearance';
import { accessibility, setAccessibility, systemPrefersReducedMotion } from '../../stores/accessibility';
import { settings, setMessageCompact } from '../../stores/settings';
import { RangeField } from '../ui/RangeField';
import { Tabs } from '../ui/Tabs';
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

/** User settings → Accessibility: motion, colour, text and layout aids. */
export const AccessibilitySettingsPage: Component = () => (
  <div class="max-w-3xl space-y-8">
    <section class="space-y-3">
      <h3 class={settingsSectionTitle}>{t('settings.accessibility.motionTitle')}</h3>
      <div class="space-y-2">
        <Row
          icon="fa-person-running"
          title={t('settings.accessibility.reduceMotion')}
          description={t('settings.accessibility.reduceMotionHint')}
          control={<Toggle checked={appearance.reduceMotion} disabled={accessibility.followSystemMotion} onChange={setReduceMotion} />}
        />
        <Row
          icon="fa-desktop"
          title={t('settings.accessibility.followSystem')}
          description={
            systemPrefersReducedMotion() ? t('settings.accessibility.followSystemOnHint') : t('settings.accessibility.followSystemOffHint')
          }
          control={<Toggle checked={accessibility.followSystemMotion} onChange={(on) => setAccessibility({ followSystemMotion: on })} />}
        />
      </div>
    </section>

    <section class="space-y-3">
      <h3 class={settingsSectionTitle}>{t('settings.accessibility.colorTitle')}</h3>
      <div class={`space-y-4 ${settingsGroupFrame}`}>
        <RangeField
          label={t('settings.accessibility.saturation')}
          min={0}
          max={100}
          value={accessibility.saturation}
          valueLabel={`${accessibility.saturation}%`}
          onChange={(v) => setAccessibility({ saturation: v })}
        />
        <p class="text-xs text-muted-foreground">{t('settings.accessibility.saturationHint')}</p>
      </div>
      <Row
        icon="fa-droplet-slash"
        title={t('settings.accessibility.reduceTransparency')}
        description={t('settings.accessibility.reduceTransparencyHint')}
        control={<Toggle checked={!appearance.glass} onChange={(on) => setGlass(!on)} />}
      />
    </section>

    <section class="space-y-3">
      <h3 class={settingsSectionTitle}>{t('settings.accessibility.textTitle')}</h3>
      <div class="space-y-2">
        <Row
          icon="fa-text-height"
          title={t('settings.accessibility.textSize')}
          description={t('settings.accessibility.textSizeHint')}
          control={
            <Tabs<FontScale>
              size="sm"
              aria-label={t('settings.accessibility.textSize')}
              value={appearance.fontScale}
              onChange={setFontScale}
              items={[
                { id: 'sm', label: t('settings.accessibility.sizeSmall') },
                { id: 'md', label: t('settings.accessibility.sizeDefault') },
                { id: 'lg', label: t('settings.accessibility.sizeLarge') },
              ]}
            />
          }
        />
        <Row
          icon="fa-link"
          title={t('settings.accessibility.underlineLinks')}
          description={t('settings.accessibility.underlineLinksHint')}
          control={<Toggle checked={accessibility.underlineLinks} onChange={(on) => setAccessibility({ underlineLinks: on })} />}
        />
        <Row
          icon="fa-compress"
          title={t('settings.accessibility.compact')}
          description={t('settings.accessibility.compactHint')}
          control={<Toggle checked={settings.messageCompact} onChange={setMessageCompact} />}
        />
      </div>
      <Show when={accessibility.followSystemMotion}>
        <p class="text-xs text-muted-foreground">{t('settings.accessibility.alsoAppearance')}</p>
      </Show>
    </section>
  </div>
);
