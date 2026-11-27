import type { Component } from 'solid-js';
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
  EMOJIS_PER_SPACE,
  EMOJI_MAX_BYTES,
  deleteSpaceEmoji,
  listSpaceEmojis,
  renameSpaceEmoji,
  type CustomEmoji,
} from '../../api/emojis';
import { customEmojis, setCustomEmojis } from '../../stores/customEmojis';
import { confirmDialog } from '../../stores/confirmDialog';
import { formatFileSize } from '../../lib/attachments/format';
import {
  EMOJI_MIME_TYPES,
  EMOJI_NAME_MAX,
  EMOJI_NAME_RE,
  EMOJI_PROBLEM_KEY,
  emojiDraftProblems,
  emojiExtension,
  emojiUploadErrorText,
  freeEmojiSlots,
  isEmojiImageName,
  namesForNewFiles,
  rememberSpaceEmoji,
  uploadEmojiItems,
} from '../../lib/emojiBulk';
import { ZipError, isZipFile, readZip, zipSupported } from '../../lib/zip';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { EmptyState } from '../ui/EmptyState';
import { settingsGroupFrame, settingsSectionTitle } from './settingsChrome';
import { t } from '../../i18n';

const EmojiRow: Component<{ spaceId: string; emoji: CustomEmoji; onError: (m: string) => void }> = (props) => {
  const [name, setName] = createSignal(props.emoji.name);
  const [busy, setBusy] = createSignal(false);
  const dirty = () => name().trim() !== props.emoji.name;

  async function save() {
    const n = name().trim();
    if (!dirty()) return;
    if (!EMOJI_NAME_RE.test(n)) {
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

/** One image under review in the bulk uploader. */
interface DraftRow {
  key: string;
  file: File;
  filename: string;
  size: number;
  previewUrl: string;
  name: string;
  status: 'ready' | 'queued' | 'uploading' | 'error';
  /** The server's refusal, translated, when status is 'error'. */
  error?: string;
}

/** A .zip bigger than this is not opened in the page (a full space is 50 x 512 KB). */
const ZIP_MAX_BYTES = 64 * 1024 * 1024;
/** At most this many images are taken out of one archive. */
const ZIP_MAX_ENTRIES = 100;

const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

let draftSeq = 0;

/**
 * Space settings → Emojis: upload one or many custom emoji (pick or drop images or a .zip,
 * review names and problems, upload in batches with progress), rename and delete.
 */
export const SpaceEmojiSettings: Component<{ spaceId: string }> = (props) => {
  const [err, setErr] = createSignal('');
  const [notice, setNotice] = createSignal('');
  const [draft, setDraft] = createStore<{ rows: DraftRow[] }>({ rows: [] });
  const [busy, setBusy] = createSignal(false);
  const [reading, setReading] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const [progress, setProgress] = createSignal<{ done: number; total: number } | null>(null);
  const [waitSeconds, setWaitSeconds] = createSignal(0);
  // Counts the rate-limit wait down once a second, so the line under the bar stays true.
  let waitTimer: ReturnType<typeof setInterval> | undefined;
  function startWait(seconds: number) {
    clearInterval(waitTimer);
    setWaitSeconds(seconds);
    waitTimer = setInterval(() => {
      const left = waitSeconds() - 1;
      setWaitSeconds(Math.max(0, left));
      if (left <= 0) clearInterval(waitTimer);
    }, 1000);
  }
  function stopWait() {
    clearInterval(waitTimer);
    setWaitSeconds(0);
  }
  let fileInput: HTMLInputElement | undefined;
  let abort: AbortController | null = null;
  let dragDepth = 0;

  const list = () => customEmojis.bySpaceId[props.spaceId] ?? [];
  const free = () => freeEmojiSlots(list().length);
  const problems = createMemo(() =>
    emojiDraftProblems(draft.rows, { existingNames: list().map((e) => e.name), free: free(), maxBytes: EMOJI_MAX_BYTES })
  );
  const sendable = () => draft.rows.filter((r) => r.status !== 'uploading' && problems()[r.key] == null);

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

  onCleanup(() => {
    abort?.abort();
    clearInterval(waitTimer);
    for (const r of draft.rows) if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
  });

  /** Files out of a dropped or chosen .zip, as Files; reports what it had to leave out. */
  async function filesFromZip(zip: File): Promise<File[]> {
    if (!zipSupported()) {
      setErr(t('spaceEmoji.bulk.zipUnsupported'));
      return [];
    }
    if (zip.size > ZIP_MAX_BYTES) {
      setErr(t('spaceEmoji.bulk.zipFailed', { name: zip.name }));
      return [];
    }
    try {
      const { files, skipped } = await readZip(await zip.arrayBuffer(), {
        accept: isEmojiImageName,
        maxEntryBytes: EMOJI_MAX_BYTES,
        maxEntries: ZIP_MAX_ENTRIES,
      });
      if (skipped.length > 0) setNotice(t('spaceEmoji.bulk.zipSkipped', { count: skipped.length }));
      if (files.length === 0 && skipped.length === 0) setErr(t('spaceEmoji.bulk.zipEmpty', { name: zip.name }));
      return files.map((f) => new File([f.data.slice()], f.name, { type: MIME_BY_EXT[emojiExtension(f.name)] ?? '' }));
    } catch (e) {
      if (!(e instanceof ZipError)) console.warn('emoji zip', e);
      setErr(t('spaceEmoji.bulk.zipFailed', { name: zip.name }));
      return [];
    }
  }

  async function addFiles(picked: File[]) {
    if (picked.length === 0 || busy()) return;
    setErr('');
    setNotice('');
    setReading(true);
    const files: File[] = [];
    try {
      for (const f of picked) {
        if (isZipFile(f)) files.push(...(await filesFromZip(f)));
        else files.push(f);
      }
    } finally {
      setReading(false);
    }
    if (files.length === 0) return;
    const names = namesForNewFiles(
      files.map((f) => f.name),
      [...list().map((e) => e.name), ...draft.rows.map((r) => r.name)]
    );
    const rows: DraftRow[] = files.map((file, i) => ({
      key: `d${++draftSeq}`,
      file,
      filename: file.name,
      size: file.size,
      previewUrl: isEmojiImageName(file.name) || file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      name: names[i],
      status: 'ready',
    }));
    setDraft('rows', (prev) => [...prev, ...rows]);
  }

  function removeRow(key: string) {
    const row = draft.rows.find((r) => r.key === key);
    if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
    setDraft('rows', (prev) => prev.filter((r) => r.key !== key));
  }

  /** A file that is not a readable image gets the plain file icon instead of a broken one. */
  function dropPreview(key: string) {
    const row = draft.rows.find((r) => r.key === key);
    if (!row?.previewUrl) return;
    URL.revokeObjectURL(row.previewUrl);
    setDraft('rows', (r) => r.key === key, 'previewUrl', '');
  }

  function clearRows() {
    for (const r of draft.rows) if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
    setDraft('rows', []);
    setNotice('');
  }

  function setRowName(key: string, name: string) {
    setDraft(
      'rows',
      (r) => r.key === key,
      produce((r) => {
        r.name = name;
        if (r.status === 'error') {
          r.status = 'ready';
          r.error = undefined;
        }
      })
    );
  }

  async function upload() {
    const items = sendable().map((r) => ({ key: r.key, file: r.file, name: r.name.trim().replace(/^:+|:+$/g, ''), size: r.size }));
    if (items.length === 0) return;
    const keys = new Set(items.map((i) => i.key));
    setDraft(
      'rows',
      (r) => keys.has(r.key),
      produce((r) => {
        r.status = 'queued';
        r.error = undefined;
      })
    );
    setErr('');
    setNotice('');
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    abort = new AbortController();
    let done = 0;
    try {
      const summary = await uploadEmojiItems(props.spaceId, items, {
        signal: abort.signal,
        onSending: (sent) => {
          stopWait();
          const sending = new Set(sent);
          setDraft('rows', (r) => sending.has(r.key), 'status', 'uploading');
        },
        onWait: startWait,
        onResult: (outcome) => {
          setProgress({ done: ++done, total: items.length });
          if (outcome.ok) {
            rememberSpaceEmoji(props.spaceId, outcome.emoji);
            removeRow(outcome.key);
          } else {
            const message = emojiUploadErrorText(outcome.error, t, EMOJI_MAX_BYTES, formatFileSize);
            setDraft(
              'rows',
              (r) => r.key === outcome.key,
              produce((r) => {
                r.status = 'error';
                r.error = message;
              })
            );
          }
        },
      });
      // Rows the stop left unsent go back to ready.
      setDraft('rows', (r) => r.status === 'queued' || r.status === 'uploading', 'status', 'ready');
      const parts: string[] = [];
      if (summary.created > 0) parts.push(t('spaceEmoji.bulk.uploaded', { count: summary.created }));
      if (summary.failed > 0) parts.push(t('spaceEmoji.bulk.failedSome', { count: summary.failed }));
      if (summary.aborted) parts.push(t('spaceEmoji.bulk.stopped'));
      setNotice(parts.join(' '));
    } finally {
      abort = null;
      setBusy(false);
      setProgress(null);
      stopWait();
    }
  }

  function statusText(row: DraftRow): string {
    const problem = problems()[row.key];
    if (row.status === 'uploading' || row.status === 'queued') return t('spaceEmoji.bulk.statusUploading');
    if (row.status === 'error') return row.error ?? t('spaceEmoji.uploadFailed');
    if (problem) return t(EMOJI_PROBLEM_KEY[problem], { max: formatFileSize(EMOJI_MAX_BYTES) });
    return t('spaceEmoji.bulk.statusReady');
  }

  const rowHasProblem = (row: DraftRow) => row.status === 'error' || (row.status === 'ready' && problems()[row.key] != null);

  return (
    <div class="max-w-2xl space-y-6">
      <Show when={err()}>
        <p role="alert" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err()}</p>
      </Show>

      <section class={`space-y-3 ${settingsGroupFrame}`}>
        <div class="flex items-center justify-between gap-3">
          <h3 class={settingsSectionTitle}>{t('spaceEmoji.uploadTitle')}</h3>
          <span class="text-xs text-muted-foreground" title={t('spaceEmoji.bulk.slotsLeft', { count: free() })}>
            {list().length} / {EMOJIS_PER_SPACE}
          </span>
        </div>
        <p class="text-xs text-muted-foreground">
          {t('spaceEmoji.uploadHint', { max: formatFileSize(EMOJI_MAX_BYTES) })}{' '}
          <span class="font-mono text-foreground">:name:</span>.
        </p>

        <div
          class={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
            dragging() ? 'border-primary bg-primary/10' : 'border-border bg-background/60'
          }`}
          onDragEnter={(e) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            dragDepth++;
            setDragging(true);
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer?.types.includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = busy() ? 'none' : 'copy';
          }}
          onDragLeave={() => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth = 0;
            setDragging(false);
            void addFiles(Array.from(e.dataTransfer?.files ?? []));
          }}
          data-testid="emoji-dropzone"
        >
          <i class="fa-solid fa-cloud-arrow-up text-2xl text-muted-foreground" aria-hidden="true" />
          <p class="text-sm font-medium text-foreground">{t('spaceEmoji.bulk.dropTitle')}</p>
          <p class="max-w-md text-xs text-muted-foreground">{t('spaceEmoji.bulk.dropHint')}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileInput?.click()} disabled={busy()} loading={reading()}>
            {t('spaceEmoji.bulk.chooseFiles')}
          </Button>
          <input
            ref={(el) => {
              fileInput = el;
            }}
            type="file"
            multiple
            accept={[...EMOJI_MIME_TYPES, '.zip', 'application/zip'].join(',')}
            class="hidden"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = '';
              void addFiles(files);
            }}
            data-testid="emoji-file-input"
          />
        </div>

        <Show when={notice()}>
          <p role="status" class="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-foreground">{notice()}</p>
        </Show>

        <Show when={draft.rows.length > 0}>
          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h4 class="text-sm font-semibold text-foreground">{t('spaceEmoji.bulk.reviewTitle')}</h4>
              <span class="text-xs text-muted-foreground">
                {t('spaceEmoji.bulk.ready', { count: sendable().length })} · {t('spaceEmoji.bulk.slotsLeft', { count: free() })}
              </span>
            </div>
            <ul class="divide-y divide-border/50 rounded-xl border border-border/60 bg-card/10" aria-label={t('spaceEmoji.bulk.reviewTitle')} data-testid="emoji-review">
              <For each={draft.rows}>
                {(row) => (
                  <li class="flex items-center gap-3 px-3 py-2" data-testid="emoji-review-row">
                    <div class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background/60">
                      <Show when={row.previewUrl} fallback={<i class="fa-regular fa-file text-muted-foreground" aria-hidden="true" />}>
                        <img src={row.previewUrl} alt="" class="size-full object-contain" onError={() => dropPreview(row.key)} />
                      </Show>
                    </div>
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <div class="flex items-center gap-1 text-sm" dir="ltr">
                        <span class="text-muted-foreground">:</span>
                        <input
                          value={row.name}
                          onInput={(e) => setRowName(row.key, e.currentTarget.value)}
                          disabled={busy()}
                          maxLength={EMOJI_NAME_MAX + 2}
                          spellcheck={false}
                          autocomplete="off"
                          aria-label={t('spaceEmoji.nameFor', { name: row.filename })}
                          aria-invalid={rowHasProblem(row)}
                          class={`min-w-0 flex-1 rounded-md border bg-background/60 px-1.5 py-1 font-mono text-sm text-foreground focus-visible:outline-none ${
                            rowHasProblem(row) ? 'border-destructive/60' : 'border-input focus:border-ring/60'
                          }`}
                        />
                        <span class="text-muted-foreground">:</span>
                      </div>
                      <p class="truncate text-[11px] text-muted-foreground" dir="auto">
                        <bdi>{row.filename}</bdi> · {formatFileSize(row.size)}
                      </p>
                      <p
                        class={`text-xs ${rowHasProblem(row) ? 'text-destructive' : 'text-muted-foreground'}`}
                        data-testid="emoji-review-status"
                      >
                        <Show when={row.status === 'uploading'}>
                          <i class="fa-solid fa-spinner fa-spin me-1" aria-hidden="true" />
                        </Show>
                        {statusText(row)}
                      </p>
                    </div>
                    <IconButton
                      size="sm"
                      tone="subtle"
                      icon="fa-solid fa-xmark"
                      label={t('spaceEmoji.bulk.remove', { name: row.filename })}
                      disabled={busy()}
                      onClick={() => removeRow(row.key)}
                    />
                  </li>
                )}
              </For>
            </ul>

            <Show when={progress()}>
              {(p) => (
                <div class="space-y-1" role="status">
                  <div
                    class="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={p().total}
                    aria-valuenow={p().done}
                  >
                    <div class="h-full bg-primary transition-[width]" style={{ width: `${(p().done / Math.max(1, p().total)) * 100}%` }} />
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {waitSeconds() > 0
                      ? t('spaceEmoji.bulk.waiting', { seconds: String(waitSeconds()) })
                      : t('spaceEmoji.bulk.progress', { done: String(p().done), total: String(p().total) })}
                  </p>
                </div>
              )}
            </Show>

            <div class="flex flex-wrap justify-end gap-2">
              <Show
                when={busy()}
                fallback={
                  <Button type="button" variant="ghost" onClick={clearRows}>
                    {t('spaceEmoji.bulk.clear')}
                  </Button>
                }
              >
                <Button type="button" variant="outline" onClick={() => abort?.abort()}>
                  {t('spaceEmoji.bulk.stop')}
                </Button>
              </Show>
              <Button type="button" onClick={() => void upload()} disabled={busy() || sendable().length === 0} loading={busy()} data-testid="emoji-upload">
                {t('spaceEmoji.bulk.uploadCount', { count: sendable().length })}
              </Button>
            </div>
          </div>
        </Show>
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
