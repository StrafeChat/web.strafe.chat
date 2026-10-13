import type { Component } from 'solid-js';
import { For, Show, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import type { AttachmentView } from '../../lib/attachments/types';
import { decryptAttachment } from '../../lib/attachments/crypto';
import { attachmentKind, fileIcon, fitWithin, formatFileSize, isVoiceMessage } from '../../lib/attachments/format';
import { getMediaDimensions, recordMediaDimensions } from '../../lib/mediaDimensions';
import { typedClipUrl } from '../../lib/media/clipFormat';
import { openMediaViewer } from '../../stores/mediaViewer';
import type { MediaViewerItem } from '../../stores/mediaViewer';
import { AudioPlayer, VideoPlayer, VoiceMessagePlayer, videoPlayerBox } from '../media';
import { t } from '../../i18n';

const MAX_W = 400;
const MAX_H = 300;

/**
 * Decrypted E2EE attachments as object URLs, cached for the session so scrolling back
 * through history doesn't re-download and re-decrypt the same file.
 *
 * Bounded, but eviction only ever takes an entry nothing on screen is using: every mounted
 * attachment holds a reference to its entry, and the least recently used unreferenced one goes
 * first. Plain insertion-order eviction revoked blob URLs that mounted rows still pointed at
 * once a session had decrypted a few dozen files - a lazy image that had not loaded yet stayed
 * a skeleton, and a download link fetched nothing.
 */
interface DecryptedEntry {
  promise: Promise<string>;
  /** The object URL once decrypted, for synchronous lookups (the media viewer's list). */
  url?: string;
  /** Mounted attachments currently showing this entry. */
  refs: number;
}
const DECRYPTED_CACHE_MAX = 60;
/** Map order is recency order: an entry is re-inserted whenever it is used again. */
const decrypted = new Map<string, DecryptedEntry>();

function decryptedKey(att: AttachmentView): string {
  return `${att.id}:${att.encryption!.iv}`;
}

/** Drop least recently used, unreferenced entries until the cache is back under its cap. If
 * everything is in use it stays over for now; the next release trims it. */
function trimDecrypted() {
  for (const [key, entry] of decrypted) {
    if (decrypted.size <= DECRYPTED_CACHE_MAX) return;
    if (entry.refs > 0) continue;
    decrypted.delete(key);
    entry.promise.then((u) => URL.revokeObjectURL(u), () => undefined);
  }
}

/** Start (or reuse) the decryption of an attachment and hold it until `release` is called, so
 * the blob URL stays valid for as long as the caller shows it. */
function acquireDecrypted(att: AttachmentView): { promise: Promise<string>; release: () => void } {
  const key = decryptedKey(att);
  let entry = decrypted.get(key);
  if (entry) {
    decrypted.delete(key);
  } else {
    const fresh: DecryptedEntry = { refs: 0, promise: Promise.resolve('') };
    fresh.promise = fetch(att.url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await decryptAttachment(await res.arrayBuffer(), att.encryption!, att.contentType);
      const u = URL.createObjectURL(blob);
      fresh.url = u;
      return u;
    });
    // A failure is not cached: the next attempt (a retry, or the row mounting again) fetches anew.
    fresh.promise.catch(() => {
      if (decrypted.get(key) === fresh) decrypted.delete(key);
    });
    entry = fresh;
  }
  const held = entry;
  held.refs++;
  decrypted.set(key, held);
  trimDecrypted();
  let released = false;
  return {
    promise: held.promise,
    release: () => {
      if (released) return;
      released = true;
      held.refs--;
      trimDecrypted();
    },
  };
}

/** The URL to show for an attachment, synchronously - '' while an E2EE blob is still decrypting. */
function displayUrlFor(att: AttachmentView): string {
  if (att.previewUrl) return att.previewUrl;
  if (att.encryption) return decrypted.get(decryptedKey(att))?.url ?? '';
  return att.url;
}

/**
 * The URL to actually show: local preview while sending, decrypted blob for E2EE, else the CDN.
 *
 * `url()` is undefined both while loading and after a failure, and never throws. Reading an
 * errored resource directly does throw, and with no error boundary around the message list
 * that left a failed download or decrypt as a skeleton shimmering forever. `failed()` tells
 * the two apart so the attachment can say so, and `retry()` tries again.
 */
function useDisplayUrl(att: () => AttachmentView) {
  let release: (() => void) | undefined;
  const letGo = () => {
    release?.();
    release = undefined;
  };
  onCleanup(letGo);
  const [res, { refetch }] = createResource(att, async (a) => {
    letGo();
    if (a.previewUrl) return a.previewUrl;
    if (a.encryption) {
      const held = acquireDecrypted(a);
      release = held.release;
      return held.promise;
    }
    return a.url;
  });
  return {
    url: (): string | undefined => (res.state === 'errored' ? undefined : res()),
    failed: () => res.state === 'errored',
    retry: () => void refetch(),
  };
}

/**
 * The URL a media player should load.
 *
 * Audio is the one kind that gets re-typed from its own bytes first. A media element decides
 * whether it can play a file from the MIME type it is handed, so a clip whose stored
 * `content_type` describes a different container than the file actually holds - the shape
 * Firefox's MediaRecorder produces when it is asked for WebM and writes Ogg - is refused
 * outright ("This file can't be played in your browser") even though the audio is fine. Reading
 * the magic number and hand-building the blob removes the served Content-Type from the
 * decision, and it fixes clips uploaded before the recorder started naming them honestly.
 * Images and video are left alone: they are streamed by the browser off a real URL, and the
 * bytes are already reachable there.
 */
function usePlayableUrl(att: () => AttachmentView) {
  const display = useDisplayUrl(att);
  // Keyed on a string, not an object: createResource refetches whenever the source's value
  // fails an === check, and a fresh object literal fails it on every notification.
  const key = createMemo(() => {
    const a = att();
    const url = display.url();
    if (!url || a.previewUrl || a.encryption) return null;
    return attachmentKind(a.contentType, a.filename) === 'audio' ? `${a.id}:${url}` : null;
  });
  const [retyped] = createResource(key, async (_key) => {
    const a = att();
    const url = display.url() ?? '';
    const fixed = await typedClipUrl(url, a.contentType, a.filename);
    return fixed ?? url;
  });
  return { ...display, url: () => retyped() ?? display.url() };
}

const UploadProgress: Component<{ att: AttachmentView }> = (props) => (
  <Show when={props.att.uploading}>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/40">
      <div class="h-full bg-primary transition-[width]" style={{ width: `${Math.round((props.att.progress ?? 0) * 100)}%` }} />
    </div>
  </Show>
);

/** Stands in for an attachment that could not be fetched or decrypted (a dropped connection, a
 * CDN error, a bad key), with a way to try again instead of a skeleton that never resolves. */
const AttachmentFailed: Component<{ att: AttachmentView; onRetry: () => void }> = (props) => (
  <div class="flex w-full max-w-md items-center gap-3 rounded-lg border border-border/80 bg-card/40 p-3">
    <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/60 text-lg text-muted-foreground">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true" />
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-foreground" title={props.att.filename}>
        {props.att.filename}
      </p>
      <p class="text-xs text-muted-foreground">{t('attachments.loadFailed')}</p>
    </div>
    <button
      type="button"
      class="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-accent"
      onClick={(e) => {
        e.stopPropagation();
        props.onRetry();
      }}
    >
      {t('common.retry')}
    </button>
  </div>
);

const ImageAttachment: Component<{ att: AttachmentView; onOpen: (url: string) => void }> = (props) => {
  const { url, failed, retry } = useDisplayUrl(() => props.att);
  const [loaded, setLoaded] = createSignal(false);
  /** The blob or CDN URL resolved but the image itself would not load or decode. */
  const [imgFailed, setImgFailed] = createSignal(false);
  // Reserve the exact box up front (from the stored dimensions, or ones we cached last time we saw
  // this URL) so the image fades into held space instead of shoving the messages below it.
  const box = createMemo(() => {
    const w = props.att.width ?? getMediaDimensions(props.att.url)?.width ?? 0;
    const h = props.att.height ?? getMediaDimensions(props.att.url)?.height ?? 0;
    return w > 0 && h > 0 ? fitWithin(w, h, MAX_W, MAX_H) : null;
  });
  const onLoad = (e: Event & { currentTarget: HTMLImageElement }) => {
    setLoaded(true);
    recordMediaDimensions(props.att.url, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };
  return (
    <Show
      when={!failed()}
      fallback={
        <AttachmentFailed
          att={props.att}
          onRetry={() => {
            setImgFailed(false);
            retry();
          }}
        />
      }
    >
      {/* The bytes arrived but the browser cannot draw them - a HEIC from a phone, a TIFF, a
          PSD. Retrying would fail the same way, and the viewer could not draw it either, so it
          becomes a download card: the file stays reachable, and a send still in progress keeps
          its progress bar instead of turning into an error. */}
      <Show when={!imgFailed()} fallback={<FileCard att={props.att} />}>
        <button
          type="button"
          class={`group/att relative block overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            props.att.uploading ? 'cursor-default' : 'cursor-zoom-in'
          }`}
          style={box() ? { width: `${box()!.width}px`, height: `${box()!.height}px` } : undefined}
          title={props.att.filename}
          onClick={() => {
            const u = url();
            if (u && !props.att.uploading) props.onOpen(u);
          }}
        >
          <Show when={!loaded()}>
            <div class={`media-skeleton ${box() ? 'absolute inset-0' : 'h-40 w-56 max-w-full'} rounded-lg`} />
          </Show>
          <Show when={url()}>
            <img
              src={url()!}
              alt={props.att.filename}
              onLoad={onLoad}
              onError={() => setImgFailed(true)}
              loading="lazy"
              decoding="async"
              class={`rounded-lg transition-opacity duration-300 ${loaded() ? 'opacity-100' : 'opacity-0'} ${
                props.att.uploading ? '!opacity-70' : ''
              } ${box() ? 'absolute inset-0 size-full object-cover' : loaded() ? 'block max-h-[300px] max-w-full object-contain' : 'absolute'}`}
            />
          </Show>
          <UploadProgress att={props.att} />
        </button>
      </Show>
    </Show>
  );
};

const VideoAttachment: Component<{ att: AttachmentView }> = (props) => {
  const { url, failed, retry } = useDisplayUrl(() => props.att);
  // The skeleton holds the exact space the player will take, so it doesn't jump in on decrypt/load.
  const box = createMemo(() => videoPlayerBox(props.att.width, props.att.height));
  return (
    <div class="relative max-w-full overflow-hidden rounded-lg" title={props.att.filename}>
      <Show
        when={url()}
        fallback={
          <Show
            when={failed()}
            fallback={
              <div class="media-skeleton max-w-full rounded-lg" style={{ width: `${box().width}px`, height: `${box().height}px` }} />
            }
          >
            <AttachmentFailed att={props.att} onRetry={retry} />
          </Show>
        }
      >
        <VideoPlayer
          src={url()!}
          filename={props.att.filename}
          width={props.att.width}
          height={props.att.height}
          downloadUrl={props.att.uploading ? undefined : url()!}
        />
      </Show>
      <UploadProgress att={props.att} />
    </div>
  );
};

const AudioAttachment: Component<{ att: AttachmentView }> = (props) => {
  const { url, failed, retry } = usePlayableUrl(() => props.att);
  return (
    <Show
      when={url()}
      fallback={
        <Show when={failed()} fallback={<div class="media-skeleton h-20 w-full max-w-md rounded-lg" />}>
          <AttachmentFailed att={props.att} onRetry={retry} />
        </Show>
      }
    >
      <AudioPlayer
        src={url()!}
        filename={props.att.filename}
        size={props.att.size}
        downloadUrl={props.att.uploading ? undefined : url()!}
      >
        <UploadProgress att={props.att} />
      </AudioPlayer>
    </Show>
  );
};

const VoiceMessageAttachment: Component<{ att: AttachmentView }> = (props) => {
  const { url, failed, retry } = usePlayableUrl(() => props.att);
  return (
    <Show
      when={url()}
      fallback={
        <Show when={failed()} fallback={<div class="media-skeleton h-16 w-full max-w-sm rounded-lg" />}>
          <AttachmentFailed att={props.att} onRetry={retry} />
        </Show>
      }
    >
      <VoiceMessagePlayer
        src={url()!}
        size={props.att.size}
        filename={props.att.filename}
        downloadUrl={props.att.uploading ? undefined : url()!}
      >
        <UploadProgress att={props.att} />
      </VoiceMessagePlayer>
    </Show>
  );
};

const FileCard: Component<{ att: AttachmentView; children?: import('solid-js').JSX.Element }> = (props) => {
  const { url, failed, retry } = useDisplayUrl(() => props.att);
  return (
    <Show when={!failed()} fallback={<AttachmentFailed att={props.att} onRetry={retry} />}>
      <div class="relative flex w-full max-w-md flex-col gap-2 overflow-hidden rounded-lg border border-border/80 bg-card/40 p-3">
        <div class="flex items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted/60 text-lg text-muted-foreground">
            <i class={`fa-solid ${fileIcon(props.att.contentType, props.att.filename)}`} aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground" title={props.att.filename}>
              {props.att.filename}
            </p>
            <p class="text-xs text-muted-foreground">
              {formatFileSize(props.att.size)}
              <Show when={props.att.encryption}>
                <span class="ms-1.5 inline-flex items-center gap-1" title={t('room.e2eeBadge')}>
                  <i class="fa-solid fa-lock text-[9px]" aria-hidden="true" />
                </span>
              </Show>
            </p>
          </div>
          <Show when={url() && !props.att.uploading}>
            <a
              href={url()!}
              download={props.att.filename}
              target="_blank"
              rel="noopener noreferrer"
              class="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={t('attachments.download')}
              aria-label={t('attachments.downloadNamed', { name: props.att.filename })}
            >
              <i class="fa-solid fa-download" aria-hidden="true" />
            </a>
          </Show>
        </div>
        {props.children}
        <UploadProgress att={props.att} />
      </div>
    </Show>
  );
};

/** Renders a message's attachments below its text: images and video inline, audio with a
 * player, everything else as a download card. A voice message gets the compact
 * play/waveform shape instead of the full audio player. */
export const MessageAttachments: Component<{ attachments: AttachmentView[] }> = (props) => {
  // Images open the app-wide viewer (mounted in AppShell) rather than a lightbox owned by
  // this component. That viewer takes the whole message's images as a list, so the arrows
  // walk between them, and it lives above the message list instead of inside one row - which
  // is what let you open the last image of a message and have the viewer vanish when that
  // row scrolled out of view or the list virtualised it away.
  //
  // Built when an image is clicked, not as a memo: an encrypted image only has a URL once it
  // has decrypted, and the decryption cache is not reactive, so a memo built when the row
  // mounted (before that) held an empty list for good and clicking the image opened nothing.
  const viewerItem = (a: AttachmentView, url: string): MediaViewerItem => ({
    url,
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    width: a.width,
    height: a.height,
  });
  const images = (): MediaViewerItem[] =>
    props.attachments
      .filter((a) => attachmentKind(a.contentType, a.filename) === 'image' && !a.uploading)
      .map((a) => viewerItem(a, displayUrlFor(a)))
      .filter((i) => !!i.url);

  return (
    <div class="mt-1 flex max-w-full flex-wrap gap-2">
      <For each={props.attachments}>
        {(att) => {
          const kind = () => attachmentKind(att.contentType, att.filename);
          return (
            <Show
              when={kind() === 'image'}
              fallback={
                <Show
                  when={kind() === 'video'}
                  fallback={
                    <Show
                      when={kind() === 'audio'}
                      fallback={<FileCard att={att} />}
                    >
                      <Show
                        when={isVoiceMessage(att.contentType, att.filename)}
                        fallback={<AudioAttachment att={att} />}
                      >
                        <VoiceMessageAttachment att={att} />
                      </Show>
                    </Show>
                  }
                >
                  <VideoAttachment att={att} />
                </Show>
              }
            >
              <ImageAttachment
                att={att}
                onOpen={(url) => {
                  const list = images();
                  const i = list.findIndex((x) => x.url === url);
                  // The clicked image is on screen, so it opens even if the list somehow lacks it.
                  if (i >= 0) openMediaViewer(list, i);
                  else openMediaViewer([viewerItem(att, url)], 0);
                }}
              />
            </Show>
          );
        }}
      </For>
    </div>
  );
};
