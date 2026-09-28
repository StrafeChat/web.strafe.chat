import type { Component, JSX } from 'solid-js';
import { createSignal, For, Show } from 'solid-js';
import {
  DEFAULT_KEYBINDS,
  FIXED_SHORTCUTS,
  KEYBIND_ACTIONS,
  comboFromEvent,
  comboParts,
  keybinds,
  resetAllKeybinds,
  resetKeybind,
  setKeybind,
  type KeybindAction,
} from '../../stores/keybinds';
import { settings, setRestoreLastVisited, setSpellcheck } from '../../stores/settings';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Toggle } from '../ui/Toggle';
import { settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
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

const Kbd: Component<{ combo: string; muted?: boolean }> = (props) => (
  <span class="inline-flex items-center gap-1" dir="ltr">
    <Show when={props.combo} fallback={<span class="text-xs text-muted-foreground">{t('settings.keybinds.unbound')}</span>}>
      <For each={comboParts(props.combo)}>
        {(part, i) => (
          <>
            <Show when={i() > 0}>
              <span class="text-[10px] text-muted-foreground">+</span>
            </Show>
            <kbd class={`rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] ${props.muted ? 'bg-muted/30 text-muted-foreground' : 'bg-muted/60 text-foreground'}`}>{part}</kbd>
          </>
        )}
      </For>
    </Show>
  </span>
);

const ACTION_ICONS: Record<KeybindAction, string> = {
  openSettings: 'fa-gear',
  toggleMembers: 'fa-user-group',
  focusSearch: 'fa-magnifying-glass',
  markSpaceRead: 'fa-check-double',
  prevRoom: 'fa-arrow-up',
  nextRoom: 'fa-arrow-down',
  toggleCompact: 'fa-compress',
  toggleMute: 'fa-microphone-slash',
  toggleDeafen: 'fa-headphones',
  disconnectVoice: 'fa-phone-slash',
};

/** User settings → System & keybinds: launch behaviour, composer options and shortcuts. */
export const KeybindsSettingsPage: Component = () => {
  const [recording, setRecording] = createSignal<KeybindAction | null>(null);

  function onRecordKey(e: KeyboardEvent, action: KeybindAction) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setRecording(null);
      return;
    }
    const combo = comboFromEvent(e);
    if (!combo) return; // modifier only - keep waiting
    setKeybind(action, combo);
    setRecording(null);
  }

  const conflict = (action: KeybindAction) => {
    const c = keybinds[action];
    return !!c && KEYBIND_ACTIONS.some((a) => a !== action && keybinds[a] === c);
  };

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.keybinds.systemTitle')}</h3>
        <div class="space-y-2">
          <Row
            icon="fa-rotate-left"
            title={t('settings.keybinds.restoreLast')}
            description={t('settings.keybinds.restoreLastHint')}
            control={<Toggle checked={settings.restoreLastVisited} onChange={setRestoreLastVisited} />}
          />
          <Row
            icon="fa-spell-check"
            title={t('settings.keybinds.spellcheck')}
            description={t('settings.keybinds.spellcheckHint')}
            control={<Toggle checked={settings.spellcheck} onChange={setSpellcheck} />}
          />
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class={settingsSectionTitle}>{t('settings.keybinds.title')}</h3>
          <Button size="sm" variant="ghost" onClick={resetAllKeybinds}>
            {t('settings.keybinds.resetAll')}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">{t('settings.keybinds.hint')}</p>
        <div class="divide-y divide-border/50 rounded-xl border border-border/70 bg-card/10">
          <For each={KEYBIND_ACTIONS}>
            {(action) => {
              const isRecording = () => recording() === action;
              return (
                <div class="flex items-center gap-3 px-3 py-2.5">
                  <div class={`${settingsRowIcon} size-8`}>
                    <i class={`fa-solid ${ACTION_ICONS[action]} text-xs`} aria-hidden="true" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-foreground">{t(`settings.keybinds.actions.${action}`)}</p>
                    <Show when={conflict(action)}>
                      <p class="text-xs text-amber-500">{t('settings.keybinds.conflict')}</p>
                    </Show>
                  </div>
                  <button
                    type="button"
                    class={`min-w-[8rem] rounded-lg border px-3 py-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isRecording() ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/40 hover:bg-muted/30'
                    }`}
                    aria-label={t('settings.keybinds.editFor', { name: t(`settings.keybinds.actions.${action}`) })}
                    onClick={() => setRecording(isRecording() ? null : action)}
                    onKeyDown={(e) => isRecording() && onRecordKey(e, action)}
                    onBlur={() => isRecording() && setRecording(null)}
                  >
                    <Show when={!isRecording()} fallback={<span class="text-xs text-primary">{t('settings.keybinds.pressKeys')}</span>}>
                      <Kbd combo={keybinds[action]} />
                    </Show>
                  </button>
                  <IconButton
                    size="sm"
                    icon="fa-solid fa-rotate-left"
                    label={t('settings.keybinds.reset')}
                    disabled={keybinds[action] === DEFAULT_KEYBINDS[action]}
                    onClick={() => resetKeybind(action)}
                  />
                  <IconButton
                    size="sm"
                    tone="danger"
                    icon="fa-solid fa-xmark"
                    label={t('settings.keybinds.unbind')}
                    disabled={!keybinds[action]}
                    onClick={() => setKeybind(action, '')}
                  />
                </div>
              );
            }}
          </For>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.keybinds.fixedTitle')}</h3>
        <div class="divide-y divide-border/50 rounded-xl border border-border/70 bg-card/10">
          <For each={FIXED_SHORTCUTS}>
            {(s) => (
              <div class="flex items-center justify-between gap-3 px-3 py-2.5">
                <p class="text-sm text-foreground">{t(`settings.keybinds.fixed.${s.id}`)}</p>
                <Show when={s.combo} fallback={<span class="text-xs text-muted-foreground">{t('settings.keybinds.anyKey')}</span>}>
                  <Kbd combo={s.combo} muted />
                </Show>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
};
