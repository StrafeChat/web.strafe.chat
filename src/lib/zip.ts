/**
 * Just enough of a ZIP reader to take images out of an archive in the browser - for the bulk
 * emoji upload, where packs are usually shared as .zip. Reads the central directory, keeps
 * the entries `accept` wants, and inflates them with the browser's own DecompressionStream
 * ("deflate-raw"), so it costs no dependency. Stored and deflated entries only; no ZIP64, no
 * encryption (those entries are skipped, not failed on).
 *
 * The archive is someone else's file: every size is bounded before and during inflation, so
 * a crafted entry cannot make the page allocate more than `maxEntryBytes` for it.
 */

export interface ZipEntryFile {
  /** The entry's file name without its folders. */
  name: string;
  /** The full path inside the archive. */
  path: string;
  data: Uint8Array;
}

export interface ZipSkipped {
  path: string;
  reason: 'size' | 'unsupported' | 'limit';
}

export interface ZipReadOptions {
  /** Which entries to take (by file name); others are ignored without a note. */
  accept: (name: string) => boolean;
  /** An entry bigger than this, declared or inflated, is skipped as 'size'. */
  maxEntryBytes: number;
  /** At most this many entries are taken; the rest are skipped as 'limit'. */
  maxEntries: number;
}

export class ZipError extends Error {}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export function zipSupported(): boolean {
  return typeof DecompressionStream !== 'undefined';
}

export function isZipFile(file: { name: string; type?: string }): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
}

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array | null> {
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Read the entries of a ZIP archive. Throws ZipError when it is not one this can read. */
export async function readZip(buffer: ArrayBuffer, opts: ZipReadOptions): Promise<{ files: ZipEntryFile[]; skipped: ZipSkipped[] }> {
  if (!zipSupported()) throw new ZipError('unsupported');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // The end-of-central-directory record is the last 22 bytes plus a comment of up to 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('not a zip');
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff || cdOffset + cdSize > bytes.length) throw new ZipError('unsupported zip');

  const decoder = new TextDecoder();
  const files: ZipEntryFile[] = [];
  const skipped: ZipSkipped[] = [];
  let p = cdOffset;
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CEN_SIG) throw new ZipError('corrupt zip');
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const path = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    const name = path.replace(/^.*\//, '');
    // Folders, macOS resource forks and hidden files are never images someone meant.
    if (!name || path.endsWith('/') || path.startsWith('__MACOSX/') || name.startsWith('.') || !opts.accept(name)) continue;
    if (files.length >= opts.maxEntries) {
      skipped.push({ path, reason: 'limit' });
      continue;
    }
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8) || compSize === 0xffffffff || size === 0xffffffff) {
      skipped.push({ path, reason: 'unsupported' });
      continue;
    }
    if (size > opts.maxEntryBytes) {
      skipped.push({ path, reason: 'size' });
      continue;
    }
    if (local + 30 > bytes.length || view.getUint32(local, true) !== LOC_SIG) throw new ZipError('corrupt zip');
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + compSize > bytes.length) throw new ZipError('corrupt zip');
    const raw = bytes.subarray(start, start + compSize);
    let data: Uint8Array | null;
    if (method === 0) {
      data = raw.byteLength <= opts.maxEntryBytes ? raw.slice() : null;
    } else {
      try {
        data = await inflateRaw(raw, opts.maxEntryBytes);
      } catch {
        skipped.push({ path, reason: 'unsupported' });
        continue;
      }
    }
    if (!data) {
      skipped.push({ path, reason: 'size' });
      continue;
    }
    files.push({ name, path, data });
  }
  return { files, skipped };
}
