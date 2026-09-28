import type { Component, JSX } from 'solid-js';
import { createMemo, createSignal, For, Show } from 'solid-js';
import {
  settings,
  setMessageCompact,
  setMembersPanelOpen,
  type SettingsData,
} from '../../stores/settings';
import {
  allThemes,
  appearance,
  deleteCustomTheme,
  setCorners,
  setCustomCss,
  setCustomCssEnabled,
  setFont,
  setFontScale,
  setGlass,
  setReduceMotion,
  setThemeId,
  type CornerStyle,
  type FontChoice,
  type FontScale,
} from '../../stores/appearance';
import type { ThemeDefinition } from '../../theme/themes';
import { setEmojiProvider, setEmojiSkinTone } from '../../stores/appearance';
import { EMOJI_PROVIDERS, getEmojiProvider, type EmojiProviderId } from '../../lib/emoji/providers';
import { SKIN_TONES } from '../../lib/emoji/data';
import { Emoji } from '../emoji/Emoji';
import { Toggle } from '../ui/Toggle';
import { Tabs } from '../ui/Tabs';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Textarea } from '../ui/Textarea';
import { ThemeEditorDialog } from './ThemeEditorDialog';
import { confirmDialog } from '../../stores/confirmDialog';
import { settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import { t } from '../../i18n';

const rowShell = settingsRowShell;
const rowIcon = settingsRowIcon;
const sectionTitle = settingsSectionTitle;

const SettingRow: Component<{ icon: string; title: string; description: string; control: JSX.Element }> = (props) => (
  <div class={rowShell}>
    <div class={rowIcon}>
      <i class={`fa-solid ${props.icon} text-sm`} aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-semibold text-foreground">{props.title}</p>
      <p class="mt-0.5 text-xs leading-snug text-muted-foreground">{props.description}</p>
    </div>
    <div class="shrink-0">{props.control}</div>
  </div>
);

/** Miniature of a theme: canvas, a rail, two text lines and a brand button. */
const ThemePreview: Component<{ theme: ThemeDefinition }> = (props) => (
  <div
    class="h-24 w-full overflow-hidden rounded-xl border"
    style={{ 'background-color': props.theme.colors.background, 'border-color': props.theme.colors.border }}
    aria-hidden="true"
  >
    <div class="flex h-full">
      <div class="flex w-9 flex-col items-center gap-1.5 py-2" style={{ 'background-color': props.theme.colors.card }}>
        <span class="size-5 rounded-full" style={{ 'background-color': props.theme.colors.primary }} />
        <span class="size-5 rounded-full" style={{ 'background-color': props.theme.colors.muted }} />
      </div>
      <div class="flex-1 space-y-1.5 p-2.5">
        <div class="h-2 w-16 rounded-sm" style={{ 'background-color': props.theme.colors.foreground }} />
        <div class="h-2 w-24 rounded-sm opacity-70" style={{ 'background-color': props.theme.colors.mutedForeground }} />
        <div class="h-2 w-20 rounded-sm opacity-70" style={{ 'background-color': props.theme.colors.mutedForeground }} />
        <div class="mt-2.5 flex gap-1.5">
          <span class="h-5 w-12 rounded-md" style={{ 'background-color': props.theme.colors.primary }} />
          <span class="h-5 w-8 rounded-md border" style={{ 'border-color': props.theme.colors.border, 'background-color': props.theme.colors.card }} />
        </div>
      </div>
    </div>
  </div>
);

export const AppearanceSettingsPage: Component = () => {
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editorBase, setEditorBase] = createSignal<ThemeDefinition | null>(null);
  const [cssDraft, setCssDraft] = createSignal(appearance.customCss);

  const themes = createMemo(() => allThemes());
  const cssDirty = () => cssDraft() !== appearance.customCss;

  function openEditor(base: ThemeDefinition | null) {
    setEditorBase(base);
    setEditorOpen(true);
  }

  function applyCss() {
    setCustomCss(cssDraft());
    if (cssDraft().trim() && !appearance.customCssEnabled) setCustomCssEnabled(true);
  }

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class={sectionTitle}>{t('settings.appearance.theme.title')}</h3>
          <Button size="sm" variant="outline" onClick={() => openEditor(themes().find((th) => th.id === appearance.themeId) ?? null)}>
            <i class="fa-solid fa-plus text-xs" aria-hidden="true" />
            {t('settings.appearance.theme.create')}
          </Button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={themes()}>
            {(th) => {
              const selected = () => appearance.themeId === th.id;
              return (
                <div class="group/theme relative">
                  <button
                    type="button"
                    class={`w-full rounded-2xl border p-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected()
                        ? 'border-primary/60 bg-primary/10 ring-1 ring-inset ring-primary/40'
                        : 'border-border bg-muted/15 hover:bg-muted/30'
                    }`}
                    aria-pressed={selected()}
                    onClick={() => setThemeId(th.id)}
                  >
                    <ThemePreview theme={th} />
                    <div class="flex items-center gap-2 px-1 pb-0.5 pt-2.5">
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-semibold text-foreground">{th.name}</span>
                        <span class="block truncate text-[11px] text-muted-foreground">
                          {th.builtin ? (th.description ?? t('settings.appearance.theme.builtIn')) : t('settings.appearance.theme.custom')} ·{' '}
                          {th.appearance === 'light' ? t('settings.appearance.theme.light') : t('settings.appearance.theme.dark')}
                        </span>
                      </span>
                      <Show when={selected()}>
                        <i class="fa-solid fa-circle-check text-primary" aria-hidden="true" />
                      </Show>
                    </div>
                  </button>
                  <div class="absolute end-3 top-3 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/theme:opacity-100">
                    <IconButton
                      size="sm"
                      icon={th.builtin ? 'fa-solid fa-clone' : 'fa-solid fa-pen'}
                      label={th.builtin ? t('settings.appearance.theme.duplicate', { name: th.name }) : t('settings.appearance.theme.edit', { name: th.name })}
                      class="bg-black/45 text-white/90 backdrop-blur hover:bg-black/65 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(th);
                      }}
                    />
                    <Show when={!th.builtin}>
                      <IconButton
                        size="sm"
                        tone="danger"
                        icon="fa-solid fa-trash"
                        label={t('settings.appearance.theme.delete', { name: th.name })}
                        class="bg-black/45 text-white/90 backdrop-blur hover:bg-black/65"
                        onClick={(e) => {
                          e.stopPropagation();
                          void confirmDialog({
                            title: t('settings.appearance.theme.deleteTitle'),
                            body: t('settings.appearance.theme.deleteConfirm', { name: th.name }),
                            confirmLabel: t('common.delete'),
                            tone: 'danger',
                            icon: 'fa-solid fa-trash',
                          }).then((ok) => {
                            if (ok) deleteCustomTheme(th.id);
                          });
                        }}
                      />
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
          <button
            type="button"
            class="flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent p-4 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => openEditor(themes().find((th) => th.id === appearance.themeId) ?? null)}
          >
            <span class="flex size-9 items-center justify-center rounded-full bg-muted/60">
              <i class="fa-solid fa-plus" aria-hidden="true" />
            </span>
            <span class="text-sm font-medium">{t('settings.appearance.theme.new')}</span>
            <span class="text-[11px]">{t('settings.appearance.theme.newHint')}</span>
          </button>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.appearance.styling')}</h3>
        <div class="space-y-2">
          <SettingRow
            icon="fa-font"
            title={t('settings.appearance.font.title')}
            description={t('settings.appearance.font.description')}
            control={
              <div class="w-40">
                <Select value={appearance.font} onValueChange={(v) => setFont(v as FontChoice)} aria-label={t('settings.appearance.font.title')}>
                  <option value="system">{t('settings.appearance.font.system')}</option>
                  <option value="inter">Inter</option>
                  <option value="outfit">Outfit</option>
                </Select>
              </div>
            }
          />
          <SettingRow
            icon="fa-text-height"
            title={t('settings.appearance.textSize.title')}
            description={t('settings.appearance.textSize.description')}
            control={
              <Tabs
                size="sm"
                aria-label={t('settings.appearance.textSize.title')}
                value={appearance.fontScale}
                onChange={(v) => setFontScale(v as FontScale)}
                items={[
                  { id: 'sm', label: t('settings.appearance.textSize.small') },
                  { id: 'md', label: t('settings.appearance.textSize.default') },
                  { id: 'lg', label: t('settings.appearance.textSize.large') },
                ]}
              />
            }
          />
          <SettingRow
            icon="fa-vector-square"
            title={t('settings.appearance.corners.title')}
            description={t('settings.appearance.corners.description')}
            control={
              <Tabs
                size="sm"
                aria-label={t('settings.appearance.corners.title')}
                value={appearance.corners}
                onChange={(v) => setCorners(v as CornerStyle)}
                items={[
                  { id: 'sharp', label: t('settings.appearance.corners.sharp') },
                  { id: 'soft', label: t('settings.appearance.corners.soft') },
                  { id: 'round', label: t('settings.appearance.corners.round') },
                ]}
              />
            }
          />
          <SettingRow
            icon="fa-droplet"
            title={t('settings.appearance.glass.title')}
            description={t('settings.appearance.glass.description')}
            control={<Toggle label={t('settings.appearance.glass.title')} checked={appearance.glass} onChange={setGlass} />}
          />
          <SettingRow
            icon="fa-person-running"
            title={t('settings.appearance.motion.title')}
            description={t('settings.appearance.motion.description')}
            control={<Toggle label={t('settings.appearance.motion.title')} checked={appearance.reduceMotion} onChange={setReduceMotion} />}
          />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.appearance.emoji.title')}</h3>
        <div class="space-y-2">
          <SettingRow
            icon="fa-face-smile"
            title={t('settings.appearance.emoji.style')}
            description={t(`emoji.providers.${getEmojiProvider(appearance.emojiProvider).id}`)}
            control={
              <div class="w-44">
                <Select
                  value={appearance.emojiProvider}
                  onValueChange={(v) => setEmojiProvider(v as EmojiProviderId)}
                  aria-label={t('settings.appearance.emoji.style')}
                >
                  <For each={EMOJI_PROVIDERS}>{(p) => <option value={p.id}>{p.name}</option>}</For>
                </Select>
              </div>
            }
          />
          <div class={`${rowShell} justify-center gap-3 py-3`} aria-label={t('settings.appearance.emoji.preview')}>
            <For each={['😀', '👍', '❤️', '🎉', '🐢', '🏳️‍🌈', '👨‍👩‍👧']}>
              {(e) => (
                <span class="text-2xl leading-none">
                  <Emoji emoji={e} />
                </span>
              )}
            </For>
          </div>
          <SettingRow
            icon="fa-hand"
            title={t('settings.appearance.emoji.skinTone')}
            description={t('settings.appearance.emoji.skinToneDescription')}
            control={
              <div class="flex items-center gap-1" role="radiogroup" aria-label={t('settings.appearance.emoji.skinTone')}>
                <For each={SKIN_TONES}>
                  {(tone) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={appearance.emojiSkinTone === tone.tone}
                      title={t(`emoji.skinTones.${tone.tone}`)}
                      class={`size-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        appearance.emojiSkinTone === tone.tone ? 'border-primary' : 'border-transparent'
                      }`}
                      style={{ 'background-color': tone.swatch }}
                      onClick={() => setEmojiSkinTone(tone.tone)}
                    />
                  )}
                </For>
              </div>
            }
          />
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={sectionTitle}>{t('settings.appearance.chat.title')}</h3>
        <div class="space-y-2">
          <SettingRow
            icon="fa-compress"
            title={t('settings.appearance.chat.compact')}
            description={t('settings.appearance.chat.compactDescription')}
            control={
              <Toggle
                label={t('settings.appearance.chat.compact')}
                checked={!!settings.messageCompact}
                onChange={() => setMessageCompact(!settings.messageCompact)}
              />
            }
          />
          <SettingRow
            icon="fa-users"
            title={t('settings.appearance.chat.membersPanel')}
            description={t('settings.appearance.chat.membersPanelDescription')}
            control={
              <Toggle
                label={t('settings.appearance.chat.membersPanel')}
                checked={!!(settings as SettingsData).membersPanelOpen}
                onChange={() => setMembersPanelOpen(!(settings as SettingsData).membersPanelOpen)}
              />
            }
          />
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class={sectionTitle}>{t('settings.appearance.css.title')}</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground">{appearance.customCssEnabled ? t('common.enabled') : t('common.disabled')}</span>
            <Toggle label={t('settings.appearance.css.enable')} checked={appearance.customCssEnabled} onChange={setCustomCssEnabled} />
          </div>
        </div>
        <div class="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-4">
          <p class="text-xs leading-snug text-muted-foreground">
            {t('settings.appearance.css.helpBefore')}
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">--color-primary</code>,{' '}
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">--radius-lg</code>
            {t('settings.appearance.css.helpAfter')}
          </p>
          <Textarea
            rows={10}
            value={cssDraft()}
            onInput={(e) => setCssDraft(e.currentTarget.value)}
            spellcheck={false}
            placeholder={':root {\n  --color-primary: #7c5cff;\n}\n\n[data-msg-id]:hover {\n  outline: 1px solid var(--color-border);\n}'}
            class="min-h-[12rem] font-mono text-xs leading-relaxed"
            aria-label={t('settings.appearance.css.title')}
          />
          <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={applyCss} disabled={!cssDirty()}>
              <i class="fa-solid fa-check text-xs" aria-hidden="true" />
              {t('common.apply')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCssDraft(appearance.customCss)} disabled={!cssDirty()}>
              {t('common.discardChanges')}
            </Button>
            <Show when={appearance.customCss}>
              <Button
                size="sm"
                variant="ghost"
                class="ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setCssDraft('');
                  setCustomCss('');
                }}
              >
                {t('common.clear')}
              </Button>
            </Show>
            <Show when={cssDirty()}>
              <span class="text-[11px] text-muted-foreground">{t('settings.appearance.css.unapplied')}</span>
            </Show>
          </div>
        </div>
      </section>

      <ThemeEditorDialog open={editorOpen()} base={editorBase()} onClose={() => setEditorOpen(false)} />
    </div>
  );
};
