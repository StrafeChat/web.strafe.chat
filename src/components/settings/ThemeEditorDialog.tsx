import type { Component } from 'solid-js';
import { createEffect, createSignal, For, Show, on, onCleanup } from 'solid-js';
import { createStore } from 'solid-js/store';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs } from '../ui/Tabs';
import { Textarea } from '../ui/Textarea';
import {
  THEME_TOKENS,
  THEME_TOKEN_GROUPS,
  exportTheme,
  isHexColor,
  normalizeHex,
  parseThemeJson,
  type ThemeDefinition,
  type ThemeTokenKey,
} from '../../theme/themes';
import { newCustomThemeId, saveCustomTheme, setPreviewTheme } from '../../stores/appearance';
import { appDialogActions, appSectionLabel, zLayer } from '../../theme/appChrome';
import { t } from '../../i18n';

/** Token names/hints come from the theme catalogue; translated when a key exists. */
function tokenLabel(tok: { key: string; label: string }): string {
  return t(`themeEditor.tokens.${tok.key}.label`, { defaultValue: tok.label });
}
function tokenHint(tok: { key: string; hint: string }): string {
  return t(`themeEditor.tokens.${tok.key}.hint`, { defaultValue: tok.hint });
}

export interface ThemeEditorDialogProps {
  open: boolean;
  /** Theme to start from. When it is a custom theme it's edited in place; a built-in is duplicated. */
  base: ThemeDefinition | null;
  onClose: () => void;
}

/**
 * Create / edit a custom theme. Every change is previewed live on the whole app (via the
 * appearance store's previewTheme) and reverted on cancel.
 */
export const ThemeEditorDialog: Component<ThemeEditorDialogProps> = (props) => {
  const [draft, setDraft] = createStore<ThemeDefinition>({
    id: '',
    name: '',
    appearance: 'dark',
    colors: { ...THEME_TOKENS.reduce((acc, tok) => ({ ...acc, [tok.key]: '#000000' }), {} as ThemeDefinition['colors']) },
  });
  const [hexDrafts, setHexDrafts] = createStore<Record<string, string>>({});
  const [importOpen, setImportOpen] = createSignal(false);
  const [importText, setImportText] = createSignal('');
  const [importError, setImportError] = createSignal('');
  const [copied, setCopied] = createSignal(false);

  const isEditingCustom = () => !!props.base && !props.base.builtin;

  // Seed the draft each time the dialog opens.
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        const base = props.base;
        const editing = base && !base.builtin;
        setDraft({
          id: editing ? base.id : newCustomThemeId(),
          name: editing ? base.name : base ? t('themeEditor.copyName', { name: base.name }) : t('themeEditor.defaultName'),
          appearance: base?.appearance ?? 'dark',
          colors: { ...(base?.colors ?? draft.colors) },
        });
        setHexDrafts({});
        setImportOpen(false);
        setImportText('');
        setImportError('');
      }
    )
  );

  // Live preview while open; clear it when the dialog closes or unmounts.
  createEffect(() => {
    if (!props.open) {
      setPreviewTheme(null);
      return;
    }
    setPreviewTheme({
      id: draft.id,
      name: draft.name,
      appearance: draft.appearance,
      colors: { ...draft.colors },
    });
  });
  onCleanup(() => setPreviewTheme(null));

  function setColor(key: ThemeTokenKey, value: string) {
    setDraft('colors', key, normalizeHex(value));
  }

  function hexValue(key: ThemeTokenKey): string {
    return hexDrafts[key] ?? draft.colors[key];
  }

  function onHexInput(key: ThemeTokenKey, raw: string) {
    setHexDrafts(key, raw);
    if (isHexColor(raw)) setColor(key, raw);
  }

  function onHexBlur(key: ThemeTokenKey) {
    setHexDrafts(key, undefined as unknown as string);
  }

  function resetToBase() {
    if (!props.base) return;
    setDraft('colors', { ...props.base.colors });
    setDraft('appearance', props.base.appearance);
    setHexDrafts({});
  }

  function handleSave() {
    saveCustomTheme({
      id: draft.id,
      name: draft.name,
      appearance: draft.appearance,
      colors: { ...draft.colors },
    });
    props.onClose();
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(
        exportTheme({ id: draft.id, name: draft.name, appearance: draft.appearance, colors: draft.colors })
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function applyImport() {
    const res = parseThemeJson(importText(), draft.colors);
    if (!res.ok) {
      setImportError(res.error);
      return;
    }
    setImportError('');
    setDraft('name', res.theme.name);
    setDraft('appearance', res.theme.appearance);
    setDraft('colors', { ...res.theme.colors });
    setHexDrafts({});
    setImportOpen(false);
    setImportText('');
  }

  return (
    <Show when={props.open}>
        <ResponsiveDialog
          size="lg"
          zClass={zLayer.modalStacked}
          onClose={props.onClose}
          title={isEditingCustom() ? t('themeEditor.editTitle') : t('themeEditor.createTitle')}
          description={t('themeEditor.description')}
        >
          <div class="space-y-5">
            <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                label={t('common.name')}
                value={draft.name}
                maxLength={60}
                onInput={(e) => setDraft('name', e.currentTarget.value)}
                placeholder={t('themeEditor.defaultName')}
              />
              <div class="space-y-1.5">
                <span class="block text-sm font-medium text-foreground">{t('themeEditor.mode')}</span>
                <Tabs
                  size="md"
                  aria-label={t('themeEditor.mode')}
                  value={draft.appearance}
                  onChange={(v) => setDraft('appearance', v)}
                  items={[
                    { id: 'dark', label: t('settings.appearance.theme.dark') },
                    { id: 'light', label: t('settings.appearance.theme.light') },
                  ]}
                />
              </div>
            </div>

            <For each={THEME_TOKEN_GROUPS}>
              {(group) => (
                <div>
                  <p class={`mb-2 ${appSectionLabel}`}>{t(`themeEditor.groups.${group}`, { defaultValue: group })}</p>
                  <div class="space-y-1 rounded-xl border border-border/70 bg-card/20 p-1.5">
                    <For each={THEME_TOKENS.filter((tok) => tok.group === group)}>
                      {(tk) => (
                        <div class="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/20">
                          <label class="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/70 shadow-inner">
                            <span class="absolute inset-0" style={{ 'background-color': draft.colors[tk.key] }} />
                            <input
                              type="color"
                              value={draft.colors[tk.key]}
                              onInput={(e) => setColor(tk.key, e.currentTarget.value)}
                              aria-label={t('themeEditor.colorFor', { name: tokenLabel(tk) })}
                              class="absolute inset-0 size-full cursor-pointer opacity-0"
                            />
                          </label>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-foreground">{tokenLabel(tk)}</p>
                            <p class="truncate text-[11px] text-muted-foreground">{tokenHint(tk)}</p>
                          </div>
                          <input
                            type="text"
                            value={hexValue(tk.key)}
                            onInput={(e) => onHexInput(tk.key, e.currentTarget.value)}
                            onBlur={() => onHexBlur(tk.key)}
                            spellcheck={false}
                            aria-label={t('themeEditor.hexFor', { name: tokenLabel(tk) })}
                            class={`h-8 w-24 shrink-0 rounded-lg border bg-background/80 px-2 font-mono text-xs text-foreground transition-colors focus:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              hexDrafts[tk.key] != null && !isHexColor(hexDrafts[tk.key]!) ? 'border-destructive' : 'border-input'
                            }`}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>

            <div class="rounded-xl border border-border/70 bg-card/20 p-3">
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setImportOpen((o) => !o)}>
                  <i class="fa-solid fa-file-import text-xs" aria-hidden="true" />
                  {t('themeEditor.importJson')}
                </Button>
                <Button size="sm" variant="outline" onClick={copyJson}>
                  <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} text-xs`} aria-hidden="true" />
                  {copied() ? t('common.copied') : t('themeEditor.copyJson')}
                </Button>
                <Show when={props.base}>
                  <Button size="sm" variant="ghost" class="ms-auto" onClick={resetToBase}>
                    {t('themeEditor.resetTo', { name: props.base!.name })}
                  </Button>
                </Show>
              </div>
              <Show when={importOpen()}>
                <div class="mt-3 space-y-2">
                  <Textarea
                    rows={5}
                    value={importText()}
                    onInput={(e) => {
                      setImportText(e.currentTarget.value);
                      setImportError('');
                    }}
                    placeholder='{"name": "…", "appearance": "dark", "colors": { "primary": "#509b6b" }}'
                    class="font-mono text-xs"
                    error={importError() || undefined}
                  />
                  <div class="flex justify-end">
                    <Button size="sm" onClick={applyImport} disabled={!importText().trim()}>
                      {t('themeEditor.loadIntoEditor')}
                    </Button>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          <div class={`${appDialogActions} mt-5`}>
            <Button variant="outline" onClick={props.onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!draft.name.trim()}>
              {isEditingCustom() ? t('common.saveChanges') : t('themeEditor.saveTheme')}
            </Button>
          </div>
        </ResponsiveDialog>
    </Show>
  );
};
