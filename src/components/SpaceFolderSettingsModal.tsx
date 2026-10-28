import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from 'solid-js';
import { Portal } from 'solid-js/web';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { Input, fieldLabelClass, inputBaseClass } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { ColorPicker } from './ui/ColorPicker';
import { appDialogActions, appMenuPanel, zLayer } from '../theme/appChrome';
import { t } from '../i18n';
import { spaceFolders, DEFAULT_FOLDER_COLOR } from '../stores/spaceFolders';
import { spaces } from '../stores/spaces';
import { orderSpacesByPreference } from '../stores/spaceOrder';
import { confirmDialog } from '../stores/confirmDialog';

interface SpaceFolderSettingsModalProps {
  open: boolean;
  onClose: () => void;
  folderId?: string | null;
  onCreated?: (folderId: string) => void;
}

const FOLDER_ICONS = [
  'fa-solid fa-folder',
  'fa-solid fa-folder-open',
  'fa-solid fa-folder-tree',
  'fa-solid fa-star',
  'fa-solid fa-heart',
  'fa-solid fa-bolt',
  'fa-solid fa-fire',
  'fa-solid fa-crown',
  'fa-solid fa-gem',
  'fa-solid fa-gift',
  'fa-solid fa-gamepad',
  'fa-solid fa-dice',
  'fa-solid fa-chess',
  'fa-solid fa-puzzle-piece',
  'fa-solid fa-ghost',
  'fa-solid fa-dragon',
  'fa-solid fa-cat',
  'fa-solid fa-dog',
  'fa-solid fa-fish',
  'fa-solid fa-dove',
  'fa-solid fa-frog',
  'fa-solid fa-paw',
  'fa-solid fa-code',
  'fa-solid fa-terminal',
  'fa-solid fa-laptop-code',
  'fa-solid fa-robot',
  'fa-solid fa-microchip',
  'fa-solid fa-atom',
  'fa-solid fa-flask',
  'fa-solid fa-dna',
  'fa-solid fa-heart-pulse',
  'fa-solid fa-stethoscope',
  'fa-solid fa-music',
  'fa-solid fa-headphones',
  'fa-solid fa-guitar',
  'fa-solid fa-microphone',
  'fa-solid fa-film',
  'fa-solid fa-camera',
  'fa-solid fa-palette',
  'fa-solid fa-paintbrush',
  'fa-solid fa-pen-nib',
  'fa-solid fa-book',
  'fa-solid fa-book-open',
  'fa-solid fa-bookmark',
  'fa-solid fa-scroll',
  'fa-solid fa-feather',
  'fa-solid fa-rocket',
  'fa-solid fa-plane',
  'fa-solid fa-sailboat',
  'fa-solid fa-car',
  'fa-solid fa-bicycle',
  'fa-solid fa-truck',
  'fa-solid fa-train',
  'fa-solid fa-compass',
  'fa-solid fa-map',
  'fa-solid fa-globe',
  'fa-solid fa-earth-americas',
  'fa-solid fa-mountain',
  'fa-solid fa-tree',
  'fa-solid fa-leaf',
  'fa-solid fa-seedling',
  'fa-solid fa-sun',
  'fa-solid fa-moon',
  'fa-solid fa-cloud',
  'fa-solid fa-snowflake',
  'fa-solid fa-umbrella',
  'fa-solid fa-house',
  'fa-solid fa-building',
  'fa-solid fa-city',
  'fa-solid fa-store',
  'fa-solid fa-briefcase',
  'fa-solid fa-chart-line',
  'fa-solid fa-coins',
  'fa-solid fa-wallet',
  'fa-solid fa-trophy',
  'fa-solid fa-medal',
  'fa-solid fa-futbol',
  'fa-solid fa-basketball',
  'fa-solid fa-dumbbell',
  'fa-solid fa-cake-candles',
  'fa-solid fa-mug-hot',
  'fa-solid fa-pizza-slice',
  'fa-solid fa-ice-cream',
  'fa-solid fa-carrot',
  'fa-solid fa-apple-whole',
  'fa-solid fa-bell',
  'fa-solid fa-comment',
  'fa-solid fa-envelope',
  'fa-solid fa-flag',
  'fa-solid fa-thumbtack',
  'fa-solid fa-magnifying-glass',
  'fa-solid fa-lock',
  'fa-solid fa-key',
  'fa-solid fa-user',
  'fa-solid fa-user-astronaut',
  'fa-solid fa-user-ninja',
  'fa-solid fa-users',
  'fa-solid fa-face-smile',
  'fa-solid fa-shield-halved',
  'fa-solid fa-wand-magic-sparkles',
];

function spaceInitial(space: { name_acronym?: string; name?: string }): string {
  const s = space.name_acronym || space.name || '?';
  return s.slice(0, 2).toUpperCase();
}

export const SpaceFolderSettingsModal: Component<SpaceFolderSettingsModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [color, setColor] = createSignal(DEFAULT_FOLDER_COLOR);
  const [icon, setIcon] = createSignal('');
  const [iconMenuOpen, setIconMenuOpen] = createSignal(false);
  const [iconMenuPos, setIconMenuPos] = createSignal<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [useSpaceIcons, setUseSpaceIcons] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  let iconMenuRoot: HTMLDivElement | undefined;
  let iconTriggerEl: HTMLButtonElement | undefined;
  let iconPanelEl: HTMLDivElement | undefined;

  const folder = createMemo(() => (props.folderId ? spaceFolders.get(props.folderId) : undefined));
  const isEdit = () => !!props.folderId;
  const memberIds = () => new Set(folder()?.spaceIds ?? []);
  const allSpaces = createMemo(() => orderSpacesByPreference(spaces.spaces));

  createEffect(() => {
    if (!props.open) return;
    const folderId = props.folderId;
    const current = untrack(() => (folderId ? spaceFolders.get(folderId) : undefined));
    setName(current?.name ?? '');
    setColor(current?.color || DEFAULT_FOLDER_COLOR);
    setIcon(current?.icon ?? '');
    setUseSpaceIcons(current?.useSpaceIcons ?? false);
    setIconMenuOpen(false);
    setError('');
  });

  createEffect(() => {
    if (!iconMenuOpen()) {
      setIconMenuPos(null);
      return;
    }
    function place() {
      const anchor = iconTriggerEl;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const edge = 8;
      const gap = 6;
      const preferred = 240;
      const below = window.innerHeight - rect.bottom - gap - edge;
      const above = rect.top - gap - edge;
      const openUp = below < 140 && above > below;
      const maxHeight = Math.max(120, Math.min(preferred, openUp ? above : below));
      const top = openUp ? Math.max(edge, rect.top - gap - maxHeight) : rect.bottom + gap;
      const width = Math.min(rect.width, window.innerWidth - edge * 2);
      const left = Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge));
      setIconMenuPos({ left, top, width, maxHeight });
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (target && (iconMenuRoot?.contains(target) || iconPanelEl?.contains(target))) return;
      setIconMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setIconMenuOpen(false);
    }
    requestAnimationFrame(place);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    });
  });

  function handleClose() {
    if (saving()) return;
    setError('');
    props.onClose();
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (saving()) return;
    const nextName = name().trim();
    setError('');
    if (!nextName) {
      setError(t('common.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const trimmedIcon = icon().trim() || undefined;
      if (props.folderId) {
        spaceFolders.update(props.folderId, {
          name: nextName,
          color: color(),
          icon: trimmedIcon,
          useSpaceIcons: useSpaceIcons(),
        });
      } else {
        const created = spaceFolders.create(nextName, {
          color: color(),
          icon: trimmedIcon,
          useSpaceIcons: useSpaceIcons(),
        });
        props.onCreated?.(created.id);
      }
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const id = props.folderId;
    if (!id || saving()) return;
    const ok = await confirmDialog({
      title: t('space.folders.delete'),
      body: t('space.folders.deleteConfirm'),
      confirmLabel: t('space.folders.delete'),
      tone: 'danger',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    spaceFolders.remove(id);
    props.onClose();
  }

  function toggleSpace(spaceId: string) {
    const id = props.folderId;
    if (!id) return;
    if (memberIds().has(spaceId)) {
      spaceFolders.setSpaceFolder(spaceId, null);
    } else {
      spaceFolders.setSpaceFolder(spaceId, id);
    }
  }

  return (
    <Show when={props.open}>
      <ResponsiveDialog
        size="xl"
        onClose={handleClose}
        dismissible={!saving()}
        icon={icon() || 'fa-solid fa-folder'}
        title={isEdit() ? t('space.folders.settings') : t('space.folders.create')}
        description={isEdit() ? t('space.folders.settingsDescription') : t('space.folders.createDescription')}
      >
        <form onSubmit={handleSubmit} class="flex flex-col gap-5">
          <Input
            id="folder-name"
            label={t('space.folders.folderName')}
            type="text"
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setError('');
            }}
            placeholder={t('space.folders.folderNamePlaceholder')}
            maxLength={100}
            disabled={saving()}
            error={error() || undefined}
            class="focus:border-transparent! focus-visible:ring-0! focus:bg-muted/40"
            autofocus
          />

          <div class="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <div class="min-w-0">
              <div class="text-sm font-medium text-foreground">{t('space.folders.useSpaceIcons')}</div>
              <p class="mt-0.5 text-xs text-muted-foreground">{t('space.folders.useSpaceIconsHint')}</p>
            </div>
            <Toggle
              label={t('space.folders.useSpaceIcons')}
              checked={useSpaceIcons()}
              disabled={saving()}
              onChange={(on) => setUseSpaceIcons(on)}
            />
          </div>

          <Show when={!useSpaceIcons()}>
            <div class="flex flex-col gap-2" ref={(el) => (iconMenuRoot = el)}>
              <span class={fieldLabelClass}>{t('space.folders.icon')}</span>
              <button
                type="button"
                ref={(el) => (iconTriggerEl = el)}
                class={`${inputBaseClass} flex h-10 min-h-10 items-center gap-2 px-3 py-2 text-start focus:border-transparent! focus-visible:ring-0! focus:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50`}
                aria-expanded={iconMenuOpen()}
                aria-haspopup="listbox"
                disabled={saving()}
                onClick={() => setIconMenuOpen((open) => !open)}
              >
                <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground">
                  <i class={icon() || 'fa-solid fa-folder'} aria-hidden="true" />
                </span>
                <span
                  class={`min-w-0 flex-1 truncate font-mono text-xs ${icon() ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {icon() || t('space.folders.chooseIcon')}
                </span>
                <i
                  class={`fa-solid fa-chevron-down shrink-0 text-[11px] text-muted-foreground transition-transform duration-200 ${
                    iconMenuOpen() ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              <Show when={iconMenuOpen()}>
                <Portal mount={document.body}>
                  <div
                    ref={(el) => (iconPanelEl = el)}
                    role="listbox"
                    aria-label={t('space.folders.icon')}
                    class={`fixed ${zLayer.popover} overflow-y-auto overscroll-contain ${appMenuPanel}`}
                    style={{
                      left: `${iconMenuPos()?.left ?? 0}px`,
                      top: `${iconMenuPos()?.top ?? 0}px`,
                      width: `${iconMenuPos()?.width ?? 0}px`,
                      'max-height': `${iconMenuPos()?.maxHeight ?? 240}px`,
                      visibility: iconMenuPos() ? 'visible' : 'hidden',
                    }}
                  >
                    <div class="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] justify-items-center gap-1">
                      <For each={FOLDER_ICONS}>
                        {(candidate) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={icon() === candidate}
                            aria-label={candidate}
                            class={`flex size-8 items-center justify-center rounded-lg text-[13px] transition-colors ${
                              icon() === candidate
                                ? 'bg-primary/20 text-foreground ring-1 ring-primary/50'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                            title={candidate}
                            onClick={() => {
                              setIcon(candidate);
                              setIconMenuOpen(false);
                            }}
                          >
                            <i class={candidate} aria-hidden="true" />
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Portal>
              </Show>
              <Input
                id="folder-icon"
                type="text"
                value={icon()}
                onInput={(e) => setIcon(e.currentTarget.value)}
                placeholder={t('space.folders.iconPlaceholder')}
                maxLength={80}
                disabled={saving()}
                class="font-mono text-xs focus:border-transparent! focus-visible:ring-0! focus:bg-muted/40"
              />
              <p class="text-xs text-muted-foreground">{t('space.folders.iconHint')}</p>
            </div>
          </Show>

          <ColorPicker
            label={t('space.folders.color')}
            value={color()}
            onChange={setColor}
            disabled={saving()}
          />

          <Show when={isEdit()}>
            <div class="flex flex-col gap-2">
              <span class={fieldLabelClass}>{t('space.folders.addSpaces')}</span>
              <p class="text-xs text-muted-foreground">{t('space.folders.addSpacesDescription')}</p>
              <div class="max-h-48 overflow-y-auto rounded-lg border border-border">
                <For
                  each={allSpaces()}
                  fallback={<p class="px-3 py-4 text-sm text-muted-foreground">{t('space.folders.noSpacesAvailable')}</p>}
                >
                  {(space) => {
                    const checked = () => memberIds().has(space.id);
                    return (
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-start transition-colors last:border-b-0 hover:bg-accent"
                        onClick={() => toggleSpace(space.id)}
                        aria-pressed={checked()}
                      >
                        <span class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/25 text-[11px] font-semibold text-foreground">
                          <Show
                            when={space.icon}
                            fallback={<span>{spaceInitial(space)}</span>}
                          >
                            <img src={space.icon!} alt="" class="size-full object-cover" />
                          </Show>
                        </span>
                        <span class="min-w-0 flex-1 truncate text-sm text-foreground">
                          {space.name || t('space.unnamed')}
                        </span>
                        <span
                          class={`flex size-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                            checked()
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          <i class="fa-solid fa-check" />
                        </span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          <div class={`${appDialogActions} ${isEdit() ? 'sm:justify-between' : ''}`}>
            <Show when={isEdit()}>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving()}>
                <i class="fa-solid fa-trash" aria-hidden="true" />
                {t('space.folders.delete')}
              </Button>
            </Show>
            <div class="ms-auto flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={saving()} disabled={!name().trim()}>
                {isEdit() ? t('common.save') : t('space.folders.create')}
              </Button>
            </div>
          </div>
        </form>
      </ResponsiveDialog>
    </Show>
  );
};
