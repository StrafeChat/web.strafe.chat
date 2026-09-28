import type { Component, JSX } from 'solid-js';
import { createEffect, createMemo, createResource, createSignal, For, Show, onCleanup } from 'solid-js';
import {
  AFK_TIMEOUTS,
  SYSTEM_FLAG_SUPPRESS_JOIN,
  SYSTEM_FLAG_SUPPRESS_LEAVE,
  getSpaceWidget,
  patchSpace,
  spaceWidgetUrl,
  type PatchSpaceInput,
  type Space,
  type SpaceRoom,
} from '../../../api/spaces';
import { addOrUpdateSpace } from '../../../stores/spaces';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Toggle } from '../../ui/Toggle';
import { settingsGroupFrame, settingsRowIcon, settingsRowShell, settingsSectionTitle } from '../settingsChrome';
import { t } from '../../../i18n';

const ROOM_TYPE_TEXT = 3;
const ROOM_TYPE_VOICE = 4;

interface Props {
  spaceId: string;
  space: Space | undefined;
  rooms: SpaceRoom[];
  canManage: boolean;
  onError: (msg: string) => void;
}

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

/**
 * Space settings → System: the system messages room and which notices go there, the
 * default notification level, the inactive voice room and the server widget. Every
 * control saves on change; the space in the store is replaced with the server's copy.
 */
export const SpaceSystemPage: Component<Props> = (props) => {
  const [busy, setBusy] = createSignal(false);
  const [savedTick, setSavedTick] = createSignal(0);

  const textRooms = createMemo(() => props.rooms.filter((r) => r.type === ROOM_TYPE_TEXT));
  const voiceRooms = createMemo(() => props.rooms.filter((r) => r.type === ROOM_TYPE_VOICE));
  const flags = () => props.space?.system_room_flags ?? 0;

  async function patch(body: PatchSpaceInput) {
    if (!props.canManage || busy()) return;
    setBusy(true);
    props.onError('');
    try {
      addOrUpdateSpace(await patchSpace(props.spaceId, body));
      setSavedTick((n) => n + 1);
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('common.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  function setFlag(bit: number, suppressed: boolean) {
    const next = suppressed ? flags() | bit : flags() & ~bit;
    void patch({ system_room_flags: next });
  }

  // Widget preview: re-fetched whenever the widget settings change.
  const widgetKey = () =>
    props.space?.widget_enabled ? `${props.spaceId}:${props.space.widget_room_id ?? ''}:${savedTick()}` : '';
  const [widget] = createResource(widgetKey, (key) => (key ? getSpaceWidget(props.spaceId).catch(() => null) : null));
  const [copied, setCopied] = createSignal(false);
  createEffect(() => {
    if (!copied()) return;
    const id = setTimeout(() => setCopied(false), 1500);
    onCleanup(() => clearTimeout(id));
  });
  async function copyWidgetUrl() {
    try {
      await navigator.clipboard.writeText(spaceWidgetUrl(props.spaceId));
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  const disabled = () => !props.canManage || busy();

  return (
    <div class="max-w-3xl space-y-8">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.system.messagesTitle')}</h3>
        <div class={`space-y-4 ${settingsGroupFrame}`}>
          <Select
            label={t('spaceSettings.system.room')}
            value={props.space?.system_room_id ?? ''}
            disabled={disabled()}
            onValueChange={(v) => void patch({ system_room_id: v })}
          >
            <option value="">{t('spaceSettings.system.noRoom')}</option>
            <For each={textRooms()}>{(r) => <option value={r.id}>#{r.name}</option>}</For>
          </Select>
          <p class="text-xs text-muted-foreground">{t('spaceSettings.system.roomHint')}</p>
          <div class="space-y-2">
            <Row
              icon="fa-user-plus"
              title={t('spaceSettings.system.joinTitle')}
              description={t('spaceSettings.system.joinHint')}
              control={
                <Toggle
                  checked={(flags() & SYSTEM_FLAG_SUPPRESS_JOIN) === 0}
                  disabled={disabled() || !props.space?.system_room_id}
                  onChange={(on) => setFlag(SYSTEM_FLAG_SUPPRESS_JOIN, !on)}
                />
              }
            />
            <Row
              icon="fa-user-minus"
              title={t('spaceSettings.system.leaveTitle')}
              description={t('spaceSettings.system.leaveHint')}
              control={
                <Toggle
                  checked={(flags() & SYSTEM_FLAG_SUPPRESS_LEAVE) === 0}
                  disabled={disabled() || !props.space?.system_room_id}
                  onChange={(on) => setFlag(SYSTEM_FLAG_SUPPRESS_LEAVE, !on)}
                />
              }
            />
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.system.notifTitle')}</h3>
        <p class="text-xs text-muted-foreground">{t('spaceSettings.system.notifHint')}</p>
        <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('spaceSettings.system.notifTitle')}>
          <For
            each={[
              { value: 0, icon: 'fa-comments', title: t('spaceSettings.system.notifAll'), hint: t('spaceSettings.system.notifAllHint') },
              { value: 1, icon: 'fa-at', title: t('spaceSettings.system.notifMentions'), hint: t('spaceSettings.system.notifMentionsHint') },
            ]}
          >
            {(opt) => {
              const selected = () => (props.space?.default_message_notifications ?? 0) === opt.value;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected()}
                  disabled={disabled()}
                  class={`flex items-start gap-3 rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected() ? 'border-primary/60 bg-primary/10 ring-1 ring-inset ring-primary/40' : 'border-border bg-muted/20 hover:bg-muted/30'
                  }`}
                  onClick={() => void patch({ default_message_notifications: opt.value })}
                >
                  <i class={`fa-solid ${opt.icon} mt-0.5 w-4 text-center text-muted-foreground`} aria-hidden="true" />
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-foreground">{opt.title}</span>
                    <span class="block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                  <Show when={selected()}>
                    <i class="fa-solid fa-circle-check ms-auto text-primary" aria-hidden="true" />
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.system.afkTitle')}</h3>
        <div class={`grid gap-4 sm:grid-cols-2 ${settingsGroupFrame}`}>
          <Select
            label={t('spaceSettings.system.afkRoom')}
            value={props.space?.afk_room_id ?? ''}
            disabled={disabled()}
            onValueChange={(v) => void patch({ afk_room_id: v })}
          >
            <option value="">{t('spaceSettings.system.noAfkRoom')}</option>
            <For each={voiceRooms()}>{(r) => <option value={r.id}>{r.name}</option>}</For>
          </Select>
          <Select
            label={t('spaceSettings.system.afkTimeout')}
            value={String(props.space?.afk_timeout || 300)}
            disabled={disabled() || !props.space?.afk_room_id}
            onValueChange={(v) => void patch({ afk_timeout: Number(v) })}
          >
            <For each={[...AFK_TIMEOUTS]}>
              {(s) => <option value={String(s)}>{t('spaceSettings.system.minutes', { count: s / 60 })}</option>}
            </For>
          </Select>
          <p class="text-xs text-muted-foreground sm:col-span-2">{t('spaceSettings.system.afkHint')}</p>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('spaceSettings.system.widgetTitle')}</h3>
        <div class={`space-y-4 ${settingsGroupFrame}`}>
          <Row
            icon="fa-window-restore"
            title={t('spaceSettings.system.widgetEnable')}
            description={t('spaceSettings.system.widgetEnableHint')}
            control={
              <Toggle
                checked={props.space?.widget_enabled === true}
                disabled={disabled()}
                onChange={(on) => void patch({ widget_enabled: on })}
              />
            }
          />
          <Select
            label={t('spaceSettings.system.widgetRoom')}
            value={props.space?.widget_room_id ?? ''}
            disabled={disabled() || !props.space?.widget_enabled}
            onValueChange={(v) => void patch({ widget_room_id: v })}
          >
            <option value="">{t('spaceSettings.system.widgetNoInvite')}</option>
            <For each={textRooms()}>{(r) => <option value={r.id}>#{r.name}</option>}</For>
          </Select>
          <Show when={props.space?.widget_enabled}>
            <div class="space-y-1.5">
              <p class="text-sm font-medium text-foreground">{t('spaceSettings.system.widgetUrl')}</p>
              <div class="flex items-stretch gap-2">
                <div class="flex min-h-10 min-w-0 flex-1 items-center break-all rounded-lg border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground" dir="ltr">
                  {spaceWidgetUrl(props.spaceId)}
                </div>
                <Button type="button" variant="outline" class="shrink-0" onClick={() => void copyWidgetUrl()}>
                  <i class={`fa-solid ${copied() ? 'fa-check' : 'fa-copy'} text-xs`} aria-hidden="true" />
                  {copied() ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">{t('spaceSettings.system.widgetUrlHint')}</p>
            </div>
            <div class="rounded-xl border border-border/70 bg-background/40 p-4">
              <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('spaceSettings.system.widgetPreview')}</p>
              <Show when={widget()} fallback={<p class="text-sm text-muted-foreground">{widget.loading ? t('common.loading') : t('spaceSettings.system.widgetUnavailable')}</p>}>
                {(w) => (
                  <div class="flex items-center gap-4">
                    <div class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-primary/20 text-base font-bold text-primary">
                      <Show when={w().icon} fallback={<span>{(props.space?.name_acronym || '?').slice(0, 2)}</span>}>
                        <img src={w().icon} alt="" class="size-full object-cover" />
                      </Show>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold text-foreground">{w().name}</p>
                      <p class="text-xs text-muted-foreground">
                        <span class="inline-flex items-center gap-1"><span class="size-2 rounded-full bg-emerald-500" /> {t('spaceSettings.system.widgetOnline', { count: w().presence_count })}</span>
                        <span class="mx-1.5">·</span>
                        {t('spaceSettings.system.widgetMembers', { count: w().member_count })}
                      </p>
                    </div>
                    <Show when={w().instant_invite}>
                      <span class="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t('spaceSettings.system.widgetJoin')}</span>
                    </Show>
                  </div>
                )}
              </Show>
            </div>
          </Show>
        </div>
      </section>
    </div>
  );
};
