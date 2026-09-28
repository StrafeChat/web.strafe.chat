import type { Component } from 'solid-js';
import { For, Show, createSignal, onMount } from 'solid-js';
import {
  EMOJIS_PER_SPACE,
  EMOJI_MAX_BYTES,
  deleteSpaceEmoji,
  listSpaceEmojis,
  renameSpaceEmoji,
  uploadSpaceEmoji,
  type CustomEmoji,
} from '../../api/emojis';
import { customEmojis, setCustomEmojis } from '../../stores/customEmojis';
import { confirmDialog } from '../../stores/confirmDialog';
import { formatFileSize } from '../../lib/attachments/format';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { IconButton } from '../ui/IconButton';
import { EmptyState } from '../ui/EmptyState';
import { settingsGroupFrame, settingsSectionTitle } from './settingsChrome';
import { t } from '../../i18n';

const NAME_RE = /^[A-Za-z0-9_]{2,32}$/;

/** Turn a file name into a plausible emoji name: "Party Blob.png" → "party_blob". */
function nameFromFile(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 32);
}

const EmojiRow: Component<{ spaceId: string; emoji: CustomEmoji; onError: (m: string) => void }> = (props) => {
  const [name, setName] = createSignal(props.emoji.name);
  const [busy, setBusy] = createSignal(false);
  const dirty = () => name().trim() !== props.emoji.name;

  async function save() {
    const n = name().trim();
    if (!dirty()) return;
    if (!NAME_RE.test(n)) {
      props.onError(t('spaceEmoji.nameRule'));
      return;
    }
    setBusy(true);
    props.onError('');
    try {
      const updated = await renameSpaceEmoji(props.spaceId, props.emoji.id, n);
      setCustomEmojis('byId', updated.id, updated);
      setCustomEmojis('bySpaceId', props.spaceId, (list) => (list ?? []).map((e) => (e.id === updated.id ? updated : e)));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceEmoji.renameFailed'));
      setName(props.emoji.name);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: t('spaceEmoji.deleteTitle'),
      body: t('spaceEmoji.deleteConfirm', { name: props.emoji.name }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      icon: 'fa-solid fa-trash',
    });
    if (!ok) return;
    setBusy(true);
    props.onError('');
    try {
      await deleteSpaceEmoji(props.spaceId, props.emoji.id);
      setCustomEmojis('bySpaceId', props.spaceId, (list) => (list ?? []).filter((e) => e.id !== props.emoji.id));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : t('spaceEmoji.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/20">
      <img src={props.emoji.url} alt={`:${props.emoji.name}:`} class="size-8 shrink-0 object-contain" />
      <div class="flex min-w-0 flex-1 items-center gap-1 text-sm" dir="ltr">
        <span class="text-muted-foreground">:</span>
        <input
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
          disabled={busy()}
          maxLength={32}
          aria-label={t('spaceEmoji.nameFor', { name: props.emoji.name })}
          class="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-mono text-sm text-foreground transition-colors hover:border-input focus:border-ring/60 focus-visible:outline-none"
        />
        <span class="text-muted-foreground">:</span>
      </div>
      <Show when={props.emoji.animated}>
        <span class="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">gif</span>
      </Show>
      <IconButton size="sm" tone="danger" icon="fa-solid fa-trash" label={t('spaceEmoji.deleteNamed', { name: props.emoji.name })} disabled={busy()} onClick={() => void remove()} />
    </div>
  );
};

/** Space settings → Emojis: upload, rename, delete custom emoji. */
export const SpaceEmojiSettings: Component<{ spaceId: string }> = (props) => {
  const [err, setErr] = createSignal('');
  const [file, setFile] = createSignal<File | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal('');
  const [name, setName] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;

  const list = () => customEmojis.bySpaceId[props.spaceId] ?? [];

  // Refresh from the server on open: the global load happened at connect time and a
  // manager may have been added or removed since.
  onMount(() => {
    listSpaceEmojis(props.spaceId)
      .then((emojis) => {
        setCustomEmojis('bySpaceId', props.spaceId, [...emojis].sort((a, b) => a.name.localeCompare(b.name)));
        for (const e of emojis) setCustomEmojis('byId', e.id, e);
      })
      .catch(() => undefined);
  });

  function pickFile(f: File | null) {
    if (previewUrl()) URL.revokeObjectURL(previewUrl());
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : '');
    if (f && !name()) setName(nameFromFile(f.name));
    setErr('');
  }

  async function upload() {
    const f = file();
    const n = name().trim();
    if (!f) return;
    if (f.size > EMOJI_MAX_BYTES) {
      setErr(t('spaceEmoji.tooLarge', { max: formatFileSize(EMOJI_MAX_BYTES) }));
      return;
    }
    if (!NAME_RE.test(n)) {
      setErr(t('spaceEmoji.nameRule'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const created = await uploadSpaceEmoji(props.spaceId, f, n);
      setCustomEmojis('byId', created.id, created);
      setCustomEmojis('bySpaceId', props.spaceId, (prev) =>
        [...(prev ?? []).filter((e) => e.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name))
      );
      pickFile(null);
      setName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('spaceEmoji.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="max-w-2xl space-y-6">
      <Show when={err()}>
        <p class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err()}</p>
      </Show>

      <section class={`space-y-3 ${settingsGroupFrame}`}>
        <div class="flex items-center justify-between">
          <h3 class={settingsSectionTitle}>{t('spaceEmoji.uploadTitle')}</h3>
          <span class="text-xs text-muted-foreground">
            {list().length} / {EMOJIS_PER_SPACE}
          </span>
        </div>
        <p class="text-xs text-muted-foreground">
          {t('spaceEmoji.uploadHint', { max: formatFileSize(EMOJI_MAX_BYTES) })}{' '}
          <span class="font-mono text-foreground">:name:</span>.
        </p>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button
            type="button"
            class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            onClick={() => fileInput?.click()}
            title={t('spaceEmoji.chooseImage')}
          >
            <Show when={previewUrl()} fallback={<i class="fa-solid fa-image text-xl" aria-hidden="true" />}>
              <img src={previewUrl()} alt="" class="size-full object-contain" />
            </Show>
          </button>
          <input
            ref={(el) => {
              fileInput = el;
            }}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            class="hidden"
            onChange={(e) => {
              pickFile(e.currentTarget.files?.[0] ?? null);
              e.currentTarget.value = '';
            }}
          />
          <div class="min-w-0 flex-1">
            <Input
              label={t('common.name')}
              value={name()}
              placeholder="party_blob"
              maxLength={32}
              onInput={(e) => setName(e.currentTarget.value)}
              disabled={busy()}
            />
          </div>
          <Button
            type="button"
            onClick={() => void upload()}
            disabled={!file() || !name().trim() || busy() || list().length >= EMOJIS_PER_SPACE}
            loading={busy()}
          >
            {t('common.upload')}
          </Button>
        </div>
      </section>

      <section class="space-y-3">
        <h3 class={settingsSectionTitle}>{t('settings.appearance.emoji.title')}</h3>
        <Show
          when={list().length > 0}
          fallback={<EmptyState icon="fa-regular fa-face-smile" body={t('spaceEmoji.none')} />}
        >
          <div class="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/10 p-1">
            <For each={list()}>{(e) => <EmojiRow spaceId={props.spaceId} emoji={e} onError={setErr} />}</For>
          </div>
        </Show>
      </section>
    </div>
  );
};
