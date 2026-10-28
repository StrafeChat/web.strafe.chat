import type { Component, JSX } from 'solid-js';
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { SearchInput } from '../ui/SearchInput';
import { Toggle } from '../ui/Toggle';
import { ResponsiveDialog } from '../ui/ResponsiveDialog';
import { EmptyState } from '../ui/EmptyState';
import { SentenceWithName } from '../ActivityStatus';
import { settingsRowIcon, settingsRowShell, settingsSectionTitle } from './settingsChrome';
import {
  gamesAdd,
  gamesGetState,
  gamesRemove,
  gamesRename,
  gamesRunningPrograms,
  gamesSetHidden,
  gamesSetShare,
  onActivityChanged,
  type GameRow,
  type GamesState,
  type RunningProgram,
} from '../../desktop/native';
import { activeDesktopAccountId } from '../../desktop/accounts';
import { instance } from '../../stores/instance';
import { selfStatus } from '../../stores/presence';
import { confirmDialog } from '../../stores/confirmDialog';
import { cleanActivityName, validActivityName } from '../../lib/activity';
import { formatDate, t } from '../../i18n';

/** How often the open page asks the shell again: a hidden game starting or a game ending
 * changes the list without changing what is shared, and that is all the shell announces. */
const REFRESH_MS = 15_000;

function sameRow(a: GameRow, b: GameRow): boolean {
  return (
    a.key === b.key &&
    a.name === b.name &&
    a.detected_name === b.detected_name &&
    a.source === b.source &&
    a.hidden === b.hidden &&
    a.renamed === b.renamed &&
    a.running === b.running
  );
}

/** The new state with every unchanged row kept as the same object, so a refresh redraws only
 * the rows that changed (and an open rename field keeps its focus). */
function keepRows(prev: GamesState | null, next: GamesState): GamesState {
  if (!prev) return next;
  const old = new Map(prev.games.map((g) => [g.key, g]));
  return {
    ...next,
    games: next.games.map((g) => {
      const o = old.get(g.key);
      return o && sameRow(o, g) ? o : g;
    }),
  };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A program's file name as a starting point for the name to show: "factory.exe" -> "factory". */
function suggestedName(program: string): string {
  return program.replace(/\.(exe|app|x86_64|x86|bin|sh|appimage)$/i, '');
}

const Row: Component<{ icon: string; title: JSX.Element; description?: JSX.Element; control?: JSX.Element }> = (props) => (
  <div class={settingsRowShell}>
    <div class={settingsRowIcon}>
      <i class={`${props.icon} text-sm`} aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-semibold text-foreground">{props.title}</p>
      <Show when={props.description}>
        <div class="mt-0.5 text-xs leading-snug text-muted-foreground">{props.description}</div>
      </Show>
    </div>
    <Show when={props.control}>
      <div class="shrink-0">{props.control}</div>
    </Show>
  </div>
);

/**
 * User settings -> Activity (desktop app only, and only a shell that can detect games): whether
 * to share the game being played, what is shared now, and the games this computer knows - to
 * rename, hide, or add one Strafe did not recognise. Everything here lives in the shell; the
 * page only asks it. The process list never reaches the page: "Add it" gets opaque ids and file
 * names, asked for when the picker opens and dropped when it closes.
 */
export const ActivitySettingsPage: Component = () => {
  const [state, setState] = createSignal<GamesState | null>(null);
  const [loadError, setLoadError] = createSignal('');
  const [actionError, setActionError] = createSignal('');
  /** The key of the row being changed ('share' for the switch), to disable its controls. */
  const [busy, setBusy] = createSignal('');
  const [editing, setEditing] = createSignal<string | null>(null);
  const [draft, setDraft] = createSignal('');
  const [adding, setAdding] = createSignal(false);

  async function refresh() {
    try {
      const next = await gamesGetState();
      setState((prev) => keepRows(prev, next));
      setLoadError('');
    } catch (e) {
      setLoadError(t('settings.activity.loadFailed', { error: errorText(e) }));
    }
  }

  onMount(() => {
    void refresh();
    const timer = setInterval(() => {
      // Not under someone typing a new name or picking a program.
      if (editing() === null && !adding()) void refresh();
    }, REFRESH_MS);
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void onActivityChanged(() => void refresh())
      .then((off) => {
        if (disposed) off();
        else unlisten = off;
      })
      .catch(() => undefined);
    onCleanup(() => {
      disposed = true;
      clearInterval(timer);
      unlisten?.();
    });
  });

  /** Run one change against the shell, then show what it now holds. */
  async function act(key: string, run: () => Promise<unknown>): Promise<boolean> {
    setBusy(key);
    setActionError('');
    try {
      await run();
      return true;
    } catch (e) {
      setActionError(t('settings.activity.actionFailed', { error: errorText(e) }));
      return false;
    } finally {
      setBusy('');
      await refresh();
    }
  }

  function setShare(on: boolean) {
    const account = activeDesktopAccountId();
    if (!account) return;
    void act('share', () => gamesSetShare(on, account));
  }

  const games = createMemo(() =>
    [...(state()?.games ?? [])].sort((a, b) => Number(b.running) - Number(a.running) || a.name.localeCompare(b.name)),
  );
  const hiddenRunning = createMemo(() => (state()?.share && !state()?.current ? games().find((g) => g.running && g.hidden) : undefined));

  function startRename(g: GameRow) {
    setActionError('');
    setDraft(g.name);
    setEditing(g.key);
  }

  async function saveRename(g: GameRow) {
    const name = cleanActivityName(draft());
    if (!name || !validActivityName(draft())) return;
    // The detected name typed back in is no rename at all.
    const ok = await act(g.key, () => gamesRename(g.key, name === g.detected_name ? null : name));
    if (ok) setEditing(null);
  }

  async function resetRename(g: GameRow) {
    const ok = await act(g.key, () => gamesRename(g.key, null));
    if (ok) setEditing(null);
  }

  async function remove(g: GameRow) {
    const ok = await confirmDialog({
      // In a plain string, the name's own direction is isolated with FSI ... PDI (a <bdi>).
      title: t('settings.activity.removeTitle', { name: `\u2068${g.name}\u2069` }),
      body: t('settings.activity.removeBody'),
      confirmLabel: t('settings.activity.remove'),
      tone: 'danger',
    });
    if (ok) void act(g.key, () => gamesRemove(g.key));
  }

  const sourceLabel = (g: GameRow) => t(`settings.activity.source.${g.source}`);

  return (
    <div class="space-y-6">
      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.activity.shareTitle')}</h3>
        <Row
          icon="fa-solid fa-gamepad"
          title={t('settings.activity.share')}
          description={t('settings.activity.shareHint')}
          control={
            <Toggle
              checked={state()?.share === true}
              disabled={!state() || busy() === 'share' || !activeDesktopAccountId()}
              label={t('settings.activity.share')}
              onChange={setShare}
            />
          }
        />
        <p class="px-0.5 text-xs leading-relaxed text-muted-foreground">{t('settings.activity.audience')}</p>
        <p class="px-0.5 text-xs leading-relaxed text-muted-foreground">{t('settings.activity.perAccount')}</p>
        <Show when={state()?.share && !instance.activitiesEnabled}>
          <p class="px-0.5 text-xs leading-relaxed text-amber-500" role="status">
            {t('settings.activity.unsupported')}
          </p>
        </Show>
        <Show when={state()?.share && instance.activitiesEnabled && selfStatus() === 'invisible'}>
          <p class="px-0.5 text-xs leading-relaxed text-muted-foreground" role="status">
            {t('settings.activity.invisible')}
          </p>
        </Show>
      </section>

      <Show when={loadError()}>
        <p class="px-0.5 text-sm text-destructive" role="alert">
          {loadError()}
        </p>
      </Show>
      <Show when={actionError()}>
        <p class="px-0.5 text-sm text-destructive" role="alert">
          {actionError()}
        </p>
      </Show>

      <Show when={state()}>
        {(s) => (
          <>
            <section class="space-y-3">
              <h3 class={settingsSectionTitle}>{t('settings.activity.currentTitle')}</h3>
              <Show
                when={s().share && s().current}
                fallback={
                  <Row
                    icon="fa-solid fa-ghost"
                    title={
                      <Show
                        when={s().share}
                        fallback={t('settings.activity.currentOff')}
                      >
                        <Show when={hiddenRunning()} fallback={t('settings.activity.currentNone')}>
                          {(g) => <SentenceWithName sentence={(name) => t('settings.activity.currentHidden', { name })} name={g().name} />}
                        </Show>
                      </Show>
                    }
                  />
                }
              >
                {(cur) => (
                  <Row
                    icon="fa-solid fa-gamepad"
                    title={<bdi>{cur().name}</bdi>}
                    description={
                      cur().started_at > 0
                        ? t('settings.activity.currentSince', { time: formatDate(cur().started_at, { timeStyle: 'short' }) })
                        : undefined
                    }
                  />
                )}
              </Show>
            </section>

            <section class="space-y-3">
              <h3 class={settingsSectionTitle}>{t('settings.activity.gamesTitle')}</h3>
              <p class="px-0.5 text-xs leading-relaxed text-muted-foreground">{t('settings.activity.gamesHint')}</p>
              <Show when={games().length > 0} fallback={<EmptyState icon="fa-solid fa-gamepad" title={t('settings.activity.gamesEmpty')} />}>
                <div class="space-y-2">
                  <For each={games()}>
                    {(g) => (
                      <div class={`${settingsRowShell} flex-wrap`}>
                        <div class={settingsRowIcon}>
                          <i class={`fa-solid ${g.hidden ? 'fa-eye-slash' : 'fa-gamepad'} text-sm`} aria-hidden="true" />
                        </div>
                        <Show
                          when={editing() === g.key}
                          fallback={
                            <>
                              <div class="min-w-0 flex-1">
                                <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-foreground">
                                  <bdi class={`min-w-0 truncate ${g.hidden ? 'text-muted-foreground' : ''}`}>{g.name}</bdi>
                                  <Show when={g.running}>
                                    <span class="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                                      {t('settings.activity.running')}
                                    </span>
                                  </Show>
                                  <Show when={g.hidden}>
                                    <span class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {t('settings.activity.hidden')}
                                    </span>
                                  </Show>
                                </p>
                                <p class="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                                  {sourceLabel(g)}
                                  <Show when={g.renamed}>
                                    {' · '}
                                    <SentenceWithName sentence={(name) => t('settings.activity.detectedAs', { name })} name={g.detected_name} />
                                  </Show>
                                </p>
                              </div>
                              <div class="flex shrink-0 items-center gap-1">
                                <IconButton
                                  icon="fa-solid fa-pen"
                                  label={t('settings.activity.rename')}
                                  disabled={busy() === g.key}
                                  onClick={() => startRename(g)}
                                />
                                <IconButton
                                  icon={g.hidden ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'}
                                  label={g.hidden ? t('settings.activity.show') : t('settings.activity.hide')}
                                  disabled={busy() === g.key}
                                  onClick={() => void act(g.key, () => gamesSetHidden(g.key, !g.hidden))}
                                />
                                <Show when={g.source === 'user'}>
                                  <IconButton
                                    icon="fa-solid fa-trash"
                                    tone="danger"
                                    label={t('settings.activity.remove')}
                                    disabled={busy() === g.key}
                                    onClick={() => void remove(g)}
                                  />
                                </Show>
                              </div>
                            </>
                          }
                        >
                          <form
                            class="min-w-0 flex-1 space-y-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveRename(g);
                            }}
                          >
                            <Input
                              label={t('settings.activity.renameLabel')}
                              value={draft()}
                              dir="auto"
                              maxLength={512}
                              autofocus
                              onInput={(e) => setDraft(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setEditing(null);
                                }
                              }}
                              error={draft() && !validActivityName(draft()) ? t('settings.activity.nameInvalid') : undefined}
                            />
                            <div class="flex flex-wrap items-center gap-2">
                              <Button type="submit" size="sm" loading={busy() === g.key} disabled={busy() === g.key || !validActivityName(draft())}>
                                {t('common.save')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                {t('common.cancel')}
                              </Button>
                              <Show when={g.renamed}>
                                <Button size="sm" variant="outline" disabled={busy() === g.key} onClick={() => void resetRename(g)}>
                                  {t('settings.activity.renameReset')}
                                </Button>
                              </Show>
                            </div>
                          </form>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Row
                icon="fa-solid fa-circle-plus"
                title={t('settings.activity.addTitle')}
                description={t('settings.activity.addHint')}
                control={
                  <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                    {t('settings.activity.addButton')}
                  </Button>
                }
              />
            </section>
          </>
        )}
      </Show>

      <Show when={adding()}>
        <AddGameDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void refresh();
          }}
        />
      </Show>
    </div>
  );
};

/**
 * "Not seeing your game? Add it": the programs running now, as the shell lists them (an opaque
 * id and the file name - never a path), asked for when this opens and again on Refresh, and
 * dropped with the dialog. The person picks one and names it.
 */
const AddGameDialog: Component<{ onClose: () => void; onAdded: () => void }> = (props) => {
  const [programs, setPrograms] = createSignal<RunningProgram[] | null>(null);
  const [listError, setListError] = createSignal('');
  const [query, setQuery] = createSignal('');
  const [picked, setPicked] = createSignal<string | null>(null);
  const [name, setName] = createSignal('');
  const [nameTouched, setNameTouched] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal('');

  async function load() {
    setPrograms(null);
    setListError('');
    try {
      const list = await gamesRunningPrograms();
      setPrograms([...list].sort((a, b) => a.name.localeCompare(b.name)));
      if (picked() && !list.some((p) => p.id === picked())) setPicked(null);
    } catch (e) {
      setPrograms([]);
      setListError(t('settings.activity.actionFailed', { error: errorText(e) }));
    }
  }
  onMount(() => void load());

  const shown = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = programs() ?? [];
    return q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
  });

  function pick(p: RunningProgram) {
    setPicked(p.id);
    setSaveError('');
    if (!nameTouched() || !name().trim()) setName(suggestedName(p.name));
  }

  async function submit() {
    const id = picked();
    const clean = cleanActivityName(name());
    if (!id || !clean || !validActivityName(name())) return;
    setSaving(true);
    setSaveError('');
    try {
      await gamesAdd(id, clean);
      props.onAdded();
    } catch (e) {
      setSaveError(t('settings.activity.addFailed', { error: errorText(e) }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      size="md"
      onClose={() => props.onClose()}
      dismissible={!saving()}
      title={t('settings.activity.addDialogTitle')}
      description={t('settings.activity.addDialogHint')}
      icon="fa-solid fa-gamepad"
      closeButton
    >
      <form
        class="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div class="flex items-center gap-2">
          <SearchInput
            size="md"
            value={query()}
            onValueChange={setQuery}
            placeholder={t('settings.activity.addSearch')}
            aria-label={t('settings.activity.addSearch')}
            wrapperClass="min-w-0 flex-1"
          />
          <IconButton icon="fa-solid fa-rotate" label={t('settings.activity.addRefresh')} disabled={programs() === null} onClick={() => void load()} />
        </div>

        <div class="max-h-64 overflow-y-auto rounded-lg border border-border" role="radiogroup" aria-label={t('settings.activity.addPrograms')}>
          <Show when={programs() !== null} fallback={<p class="px-3 py-4 text-sm text-muted-foreground">{t('settings.activity.addLoading')}</p>}>
            <Show when={listError()}>
              <p class="px-3 py-3 text-sm text-destructive" role="alert">
                {listError()}
              </p>
            </Show>
            <Show
              when={shown().length > 0}
              fallback={
                <Show when={!listError()}>
                  <p class="px-3 py-4 text-sm text-muted-foreground">
                    {(programs() ?? []).length === 0 ? t('settings.activity.addEmpty') : t('settings.activity.addNoMatch')}
                  </p>
                </Show>
              }
            >
              <For each={shown()}>
                {(p) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked() === p.id}
                    class={`flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-accent/50 ${
                      picked() === p.id ? 'bg-primary/10 text-foreground' : 'text-foreground/90'
                    }`}
                    onClick={() => pick(p)}
                  >
                    <i
                      class={`fa-solid ${picked() === p.id ? 'fa-circle-dot text-primary' : 'fa-circle text-muted-foreground/40'} text-xs`}
                      aria-hidden="true"
                    />
                    <bdi class="min-w-0 truncate font-mono text-[13px]">{p.name}</bdi>
                  </button>
                )}
              </For>
            </Show>
          </Show>
        </div>

        <Input
          label={t('settings.activity.addName')}
          placeholder={t('settings.activity.addNamePlaceholder')}
          value={name()}
          dir="auto"
          maxLength={512}
          disabled={!picked()}
          onInput={(e) => {
            setName(e.currentTarget.value);
            setNameTouched(true);
          }}
          error={name() && !validActivityName(name()) ? t('settings.activity.nameInvalid') : saveError() || undefined}
        />

        <div class="flex justify-end gap-2">
          <Button variant="ghost" disabled={saving()} onClick={() => props.onClose()}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saving()} disabled={saving() || !picked() || !validActivityName(name())}>
            {t('settings.activity.addSubmit')}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
};
