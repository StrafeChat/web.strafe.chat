import type { Component } from 'solid-js';
import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js';
import { ResponsiveDialog } from './ui/ResponsiveDialog';
import { Button } from './ui/Button';
import { Input, fieldLabelClass } from './ui/Input';
import { Toggle } from './ui/Toggle';
import { ColorPicker } from './ui/ColorPicker';
import { appDialogActions } from '../theme/appChrome';
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

const DEFAULT_ICONS = [
  'fa-solid fa-folder',
  'fa-solid fa-star',
  'fa-solid fa-heart',
  'fa-solid fa-bolt',
  'fa-solid fa-gamepad',
  'fa-solid fa-code',
  'fa-solid fa-music',
  'fa-solid fa-book',
  'fa-solid fa-flask',
  'fa-solid fa-rocket',
  'fa-solid fa-crown',
  'fa-solid fa-dice',
];

function spaceInitial(space: { name_acronym?: string; name?: string }): string {
  const s = space.name_acronym || space.name || '?';
  return s.slice(0, 2).toUpperCase();
}

export const SpaceFolderSettingsModal: Component<SpaceFolderSettingsModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [color, setColor] = createSignal(DEFAULT_FOLDER_COLOR);
  const [icon, setIcon] = createSignal('');
  const [useSpaceIcons, setUseSpaceIcons] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

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
    setError('');
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
            <div class="flex flex-col gap-2">
              <span class={fieldLabelClass}>{t('space.folders.icon')}</span>
              <div class="grid grid-cols-6 justify-items-center gap-2">
                <For each={DEFAULT_ICONS}>
                  {(candidate) => (
                    <button
                      type="button"
                      class={`flex size-9 items-center justify-center rounded-lg border text-sm transition-colors ${
                        icon() === candidate
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                      aria-label={candidate}
                      aria-pressed={icon() === candidate}
                      onClick={() => setIcon(icon() === candidate ? '' : candidate)}
                    >
                      <i class={candidate} aria-hidden="true" />
                    </button>
                  )}
                </For>
              </div>
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
