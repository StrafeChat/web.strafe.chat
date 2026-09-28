import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { LOCALES, RTL_LOCALES, currentLanguage, setLanguage, t } from '../../i18n';
import { settingsSectionTitle as sectionTitle } from './settingsChrome';

/** Pick the UI language. Stored per device (localStorage), applied instantly. */
export const LanguageSettingsPage: Component = () => {
  const active = () => currentLanguage();

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.language.pickTitle')}</h3>
        <p class="text-xs leading-snug text-muted-foreground">{t('settings.language.pickHint')}</p>
        <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('settings.language.pickTitle')}>
          <For each={LOCALES}>
            {(l) => {
              const selected = () => l.code === active();
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  lang={l.code}
                  dir={RTL_LOCALES.has(l.code) ? 'rtl' : 'ltr'}
                  class={`flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected()
                      ? 'border-primary/60 bg-primary/10 ring-1 ring-inset ring-primary/40'
                      : 'border-border bg-muted/20 hover:bg-muted/30'
                  }`}
                  onClick={() => void setLanguage(l.code)}
                >
                  <span class="select-none text-2xl leading-none" aria-hidden="true">
                    {l.flag}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-foreground">{l.label}</span>
                    <Show when={l.englishLabel !== l.label}>
                      <span class="block truncate text-[11px] text-muted-foreground" lang="en" dir="ltr">
                        {l.englishLabel}
                      </span>
                    </Show>
                  </span>
                  <Show when={selected()}>
                    <i class="fa-solid fa-circle-check text-primary" aria-hidden="true" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.language.aboutTitle')}</h3>
        <div class="space-y-2 rounded-xl border border-border bg-muted/20 px-4 py-4 text-xs leading-snug text-muted-foreground">
          <p>{t('settings.language.perDevice')}</p>
          <p>{t('settings.language.rtlNote')}</p>
          <p>{t('settings.language.contentNote')}</p>
        </div>
      </section>
    </div>
  );
};
