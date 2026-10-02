/**
 * What a recorded or uploaded audio clip actually is, and getting that to the browser in a
 * form it will decode.
 *
 * A media element decides whether it can play a file from the MIME type it is handed - the
 * `Content-Type` on the response for a remote URL, the `Blob`'s own type for an object URL.
 * If that type describes a different container than the bytes hold, playback fails outright
 * and the user sees "this file can't be played" for a clip that is perfectly fine. Two things
 * make that happen with voice messages recorded in Firefox:
 *
 *  - Firefox builds have shipped where `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')`
 *    answers yes and accepts the option, but still writes Ogg - so a `.webm` holding Ogg
 *    reaches everyone else's browser. The recorder now names the file from the bytes; see
 *    lib/voiceRecorder.ts.
 *  - Whatever the container, the served `Content-Type` decides playback. Re-typing the file
 *    from its own magic bytes sidesteps the served header entirely, which is what
 *    `typedClipUrl` below does. It also rescues clips uploaded before that fix.
 */

/** A container we can name honestly, plus the parameterless MIME type to describe it with. */
export interface ClipFormat {
  ext: string;
  /** Parameterless (`audio/webm`, never `audio/webm;codecs=opus`). */
  type: string;
}

/** Extension to media type. `.m4a` and `.mp4` are the same ISO base media format. */
const EXT_TYPES: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  weba: 'audio/webm',
};

/** The four magic numbers a clip can start with, mapped to the format they actually are. */
export function sniffClipFormat(head: Uint8Array): ClipFormat | null {
  if (head.length >= 4 && String.fromCharCode(head[0]!, head[1]!, head[2]!, head[3]!) === 'OggS') {
    return { ext: 'ogg', type: 'audio/ogg' };
  }
  // EBML header - Matroska and its WebM subset.
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return { ext: 'webm', type: 'audio/webm' };
  }
  // ISO base media file format: a 4-byte box size, then 'ftyp'.
  if (head.length >= 8 && String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!) === 'ftyp') {
    return { ext: 'm4a', type: 'audio/mp4' };
  }
  return null;
}

/** Read the first bytes of a blob. Only the head is needed and it is a few dozen bytes. */
export async function readHead(blob: Blob): Promise<Uint8Array> {
  try {
    return new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * Normalise a MIME type: lowercase, no parameters. `codecs=opus` is a playback hint, not
 * part of the media type, and it travels into the stored `content_type` and back out on the
 * `Content-Type` header - where a parameter the receiving CDN or browser doesn't recognise is
 * a reason to refuse the file. The codec still rides along in the container, which is where
 * a decoder reads it.
 */
export function bareMediaType(mimeType: string, fallback: string): string {
  const bare = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  return bare.startsWith('audio/') || bare.startsWith('video/') ? bare : fallback;
}

/** Best guess at a clip's format from its name and declared type, without reading any bytes. */
export function clipFormatFromName(contentType: string | undefined, filename?: string): ClipFormat {
  const ext = (filename ?? '').toLowerCase().split('.').pop() ?? '';
  const fromExt = EXT_TYPES[ext];
  if (fromExt) return { ext, type: fromExt };
  const declared = bareMediaType(contentType ?? '', '');
  if (declared) return { ext: ext || 'bin', type: declared };
  return { ext: 'bin', type: 'application/octet-stream' };
}

/**
 * Re-typed object URLs for audio clips whose served content type can't be trusted, cached per
 * URL for the session so scrolling back through history doesn't refetch. Only the clips that
 * need it are cached here; everything else plays straight from its URL.
 */
const retypedUrls = new Map<string, Promise<string | null>>();

/**
 * An object URL for `url` whose blob carries the container's real media type, or null when
 * the bytes can't be read (the caller should just use the original URL - a failed fetch is
 * not a reason to withhold the file).
 */
export function typedClipUrl(url: string, contentType: string | undefined, filename?: string): Promise<string | null> {
  let p = retypedUrls.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const format = sniffClipFormat(bytes) ?? clipFormatFromName(contentType, filename);
      return URL.createObjectURL(new Blob([bytes], { type: format.type }));
    })().catch(() => null);
    p.then((u) => {
      // A URL we will never hand out must not sit in the cache holding a blob alive.
      if (!u) retypedUrls.delete(url);
    });
    while (retypedUrls.size >= 40) {
      const oldest = retypedUrls.keys().next().value;
      if (!oldest) break;
      retypedUrls.get(oldest)?.then((u) => u && URL.revokeObjectURL(u), () => undefined);
      retypedUrls.delete(oldest);
    }
    retypedUrls.set(url, p);
  }
  return p;
}