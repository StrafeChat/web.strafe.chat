/**
 * Bulk custom emoji upload, shared by the web's Space settings -> Emojis and the phone app's
 * screen: names from file names (cleaned to the server's rule and made unique), the checks
 * a review table shows before anything is sent, and the uploader that sends the reviewed
 * images through `POST /spaces/:id/emojis/bulk` in batches, waits out the rate limit, and
 * reports each image on its own - one refusal never stops the rest.
 *
 * No DOM and no UI here: the phone app runs this module as-is.
 */
import {
  EMOJIS_PER_SPACE,
  EMOJI_BULK_MAX_FILES,
  EMOJI_MAX_BYTES,
  uploadSpaceEmoji,
  uploadSpaceEmojisBulk,
  type CustomEmoji,
} from '../api/emojis';
import { isApiError } from '../api/ApiError';
import { setCustomEmojis } from '../stores/customEmojis';
import { translateApiErrorMessage, type ErrorTranslateFn } from './formatApiError';

/** The server's rule (equinox spaces.ValidateEmojiName). */
export const EMOJI_NAME_RE = /^[A-Za-z0-9_]{2,32}$/;
export const EMOJI_NAME_MAX = 32;
/** Extensions the server stores, and the MIME types pickers are told to offer. */
export const EMOJI_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const;
export const EMOJI_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
/** Keep each bulk request well inside the API's body limit; a 413 still splits a batch. */
const BATCH_MAX_BYTES = 8 * 1024 * 1024;
const MAX_RATE_LIMIT_RETRIES = 6;

export function emojiExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function isEmojiImageName(filename: string): boolean {
  return (EMOJI_EXTENSIONS as readonly string[]).includes(emojiExtension(filename));
}

/** "Party Blob.png" -> "party_blob". Always a valid name: too short pads, empty is "emoji". */
export function emojiNameFromFile(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '');
  let name = base
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, EMOJI_NAME_MAX)
    .replace(/_+$/, '');
  if (!name) name = 'emoji';
  if (name.length < 2) name = `${name}_emoji`;
  return name;
}

/** `base`, or `base_2`, `base_3`... - the first one not in `taken` (lowercase names). */
export function uniqueEmojiName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = base.slice(0, EMOJI_NAME_MAX - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * Names for newly added files: each from its file name, made unique against the space's
 * emoji, the rows already under review and the earlier files of this same pick.
 */
export function namesForNewFiles(filenames: string[], taken: Iterable<string>): string[] {
  const used = new Set<string>();
  for (const n of taken) used.add(n.toLowerCase());
  return filenames.map((filename) => {
    const name = uniqueEmojiName(emojiNameFromFile(filename), used);
    used.add(name.toLowerCase());
    return name;
  });
}

/** Why a row under review cannot be sent as it is. */
export type EmojiDraftProblem =
  /** Not a PNG, JPEG, GIF or WebP. */
  | 'type'
  /** Over the size limit. */
  | 'size'
  /** Not 2-32 letters, numbers or underscores. */
  | 'name'
  /** The space already has an emoji with this name. */
  | 'taken'
  /** An earlier row in this batch has this name. */
  | 'duplicate'
  /** Fine, but the space has no free slot left for it. */
  | 'noSlot';

export interface EmojiDraftCheck {
  key: string;
  name: string;
  filename: string;
  size: number;
}

/**
 * Every row's problem (null when it can be sent), in the order the server would meet them.
 * Free slots go to the sendable rows from the top.
 */
export function emojiDraftProblems(
  rows: readonly EmojiDraftCheck[],
  opts: { existingNames: Iterable<string>; free: number; maxBytes?: number },
): Record<string, EmojiDraftProblem | null> {
  const maxBytes = opts.maxBytes ?? EMOJI_MAX_BYTES;
  const existing = new Set<string>();
  for (const n of opts.existingNames) existing.add(n.toLowerCase());
  const seen = new Set<string>();
  let free = Math.max(0, opts.free);
  const out: Record<string, EmojiDraftProblem | null> = {};
  for (const row of rows) {
    const name = row.name.trim().replace(/^:+|:+$/g, '');
    const lower = name.toLowerCase();
    let problem: EmojiDraftProblem | null = null;
    if (!isEmojiImageName(row.filename)) problem = 'type';
    else if (row.size <= 0 || row.size > maxBytes) problem = 'size';
    else if (!EMOJI_NAME_RE.test(name)) problem = 'name';
    else if (existing.has(lower)) problem = 'taken';
    else if (seen.has(lower)) problem = 'duplicate';
    if (EMOJI_NAME_RE.test(name)) seen.add(lower);
    if (!problem) {
      if (free > 0) free--;
      else problem = 'noSlot';
    }
    out[row.key] = problem;
  }
  return out;
}

/** The i18n key that explains a problem (`spaceEmoji.tooLarge` takes `{max}`). */
export const EMOJI_PROBLEM_KEY: Record<EmojiDraftProblem, string> = {
  type: 'spaceEmoji.bulk.problemType',
  size: 'spaceEmoji.tooLarge',
  name: 'spaceEmoji.nameRule',
  taken: 'spaceEmoji.nameTaken',
  duplicate: 'spaceEmoji.bulk.problemDuplicate',
  noSlot: 'spaceEmoji.bulk.problemNoSlot',
};

/** How many emoji the space can still take. */
export function freeEmojiSlots(existingCount: number): number {
  return Math.max(0, EMOJIS_PER_SPACE - existingCount);
}

// ---- upload -------------------------------------------------------------------------------

export interface EmojiUploadItem {
  key: string;
  /** What goes in the form (on the phone app, `{ uri, name, type }` typed as a File). */
  file: File;
  name: string;
  size: number;
}

export type EmojiUploadOutcome =
  | { key: string; ok: true; emoji: CustomEmoji }
  | { key: string; ok: false; status: number; error: string };

export interface EmojiUploadOptions {
  /** A batch is about to be sent: these rows are in flight. */
  onSending?: (keys: string[]) => void;
  onResult: (outcome: EmojiUploadOutcome) => void;
  /** The rate limit was hit; the uploader waits this many seconds, then tries again. */
  onWait?: (seconds: number) => void;
  /** Stops before the next request; what is in flight still finishes. */
  signal?: AbortSignal;
  /** For tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface EmojiUploadSummary {
  created: number;
  failed: number;
  /** Stopped by the signal; rows never sent got no result. */
  aborted: boolean;
}

/** Group items into requests: at most EMOJI_BULK_MAX_FILES and about BATCH_MAX_BYTES each. */
export function batchEmojiItems<T extends { size: number }>(items: readonly T[], maxFiles = EMOJI_BULK_MAX_FILES, maxBytes = BATCH_MAX_BYTES): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    if (current.length > 0 && (current.length >= maxFiles || bytes + item.size > maxBytes)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += item.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done);
  });
}

/** Seconds to wait after a 429: the server's `retry_after`, else an exponential backoff. */
function retryDelaySeconds(err: unknown, attempt: number): number {
  const raw = isApiError(err) ? Number(err.body?.retry_after) : NaN;
  if (Number.isFinite(raw) && raw > 0) return Math.min(120, Math.ceil(raw));
  return Math.min(60, 2 ** attempt * 2);
}

/** An instance from before the bulk route answers a route it lacks with a bare 404/405. */
function isMissingRoute(err: unknown): boolean {
  return isApiError(err) && (err.status === 405 || (err.status === 404 && typeof err.body?.error !== 'string'));
}

function errorStatus(err: unknown): number {
  return isApiError(err) ? err.status : 0;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Send the items, in order, and report each one through `onResult` as soon as its answer is
 * in. Rate limits are waited out (the server's `retry_after`); a batch too big for the body
 * limit is split; an instance without the bulk route gets the single-image route instead.
 */
export async function uploadEmojiItems(spaceId: string, items: readonly EmojiUploadItem[], opts: EmojiUploadOptions): Promise<EmojiUploadSummary> {
  const sleep = opts.sleep ?? defaultSleep;
  const queue = batchEmojiItems(items);
  const summary: EmojiUploadSummary = { created: 0, failed: 0, aborted: false };
  let single = false;

  const report = (outcome: EmojiUploadOutcome) => {
    if (outcome.ok) summary.created++;
    else summary.failed++;
    opts.onResult(outcome);
  };

  // Runs `send`, waiting out 429s. Throws whatever else it throws; null when aborted.
  async function withRetry<T>(send: () => Promise<T>): Promise<T | null> {
    for (let attempt = 0; ; attempt++) {
      if (opts.signal?.aborted) return null;
      try {
        return await send();
      } catch (err) {
        if (errorStatus(err) !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) throw err;
        const seconds = retryDelaySeconds(err, attempt);
        opts.onWait?.(seconds);
        await sleep(seconds * 1000, opts.signal);
      }
    }
  }

  while (queue.length > 0) {
    if (opts.signal?.aborted) {
      summary.aborted = true;
      break;
    }
    const batch = queue.shift()!;
    opts.onSending?.(batch.map((i) => i.key));

    if (single) {
      for (const item of batch) {
        try {
          const emoji = await withRetry(() => uploadSpaceEmoji(spaceId, item.file, item.name));
          if (emoji === null) {
            summary.aborted = true;
            return summary;
          }
          report({ key: item.key, ok: true, emoji });
        } catch (err) {
          report({ key: item.key, ok: false, status: errorStatus(err), error: errorMessage(err) });
        }
      }
      continue;
    }

    try {
      const res = await withRetry(() => uploadSpaceEmojisBulk(spaceId, batch.map((i) => ({ file: i.file, name: i.name }))));
      if (res === null) {
        summary.aborted = true;
        break;
      }
      const byIndex = new Map(res.results.map((r) => [r.index, r]));
      batch.forEach((item, index) => {
        const r = byIndex.get(index);
        if (r?.emoji) report({ key: item.key, ok: true, emoji: r.emoji });
        else report({ key: item.key, ok: false, status: r?.status ?? 0, error: r?.error ?? '' });
      });
    } catch (err) {
      if (isMissingRoute(err)) {
        single = true;
        queue.unshift(batch);
      } else if (errorStatus(err) === 413 && batch.length > 1) {
        const half = Math.ceil(batch.length / 2);
        queue.unshift(batch.slice(0, half), batch.slice(half));
      } else {
        for (const item of batch) report({ key: item.key, ok: false, status: errorStatus(err), error: errorMessage(err) });
      }
    }
  }
  return summary;
}

/** Put a created emoji in the shared store, so pickers everywhere offer it at once. */
export function rememberSpaceEmoji(spaceId: string, emoji: CustomEmoji): void {
  setCustomEmojis('byId', emoji.id, emoji);
  setCustomEmojis('bySpaceId', spaceId, (prev) =>
    [...(prev ?? []).filter((e) => e.id !== emoji.id), emoji].sort((a, b) => a.name.localeCompare(b.name)),
  );
}

/** A failed item's reason in the reader's language. */
export function emojiUploadErrorText(error: string, t: ErrorTranslateFn, maxBytes = EMOJI_MAX_BYTES, formatSize?: (n: number) => string): string {
  if (/^emoji images must be under /i.test(error.trim())) {
    return t('spaceEmoji.tooLarge', { max: formatSize ? formatSize(maxBytes) : `${Math.round(maxBytes / 1024)} KB` });
  }
  if (!error.trim()) return t('spaceEmoji.uploadFailed');
  return translateApiErrorMessage(error, t).join(' ');
}
