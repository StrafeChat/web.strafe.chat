import type { Component } from 'solid-js';
import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
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
 * through history doesn't re-download and re-decrypt the same file. Bounded: the oldest
 * entries are revoked once the cache grows past a few dozen.
 */
const decryptedUrls = new Map<string, Promise<string>>();
/**
 * The resolved object URLs, kept alongside the promises so an already-decrypted attachment can
 * be looked up synchronously. The viewer builds its whole item list in one go when you click,
 * and anything you can click has already rendered once, so its blob URL is in here.
 */
const decryptedUrlSync = new Map<string, string>();

function decryptedKey(att: AttachmentView): string {
  return `${att.id}:${att.encryption!.iv}`;
}

function decryptedUrlFor(att: AttachmentView): Promise<string> {
  const key = decryptedKey(att);
  let p = decryptedUrls.get(key);
  if (!p) {
    p = fetch(att.url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await decryptAttachment(await res.arrayBuffer(), att.encryption!, att.contentType);
      const u = URL.createObjectURL(blob);
      decryptedUrlSync.set(key, u);
      return u;
    });
    p.catch(() => decryptedUrls.delete(key));
    while (decryptedUrls.size >= 60) {
      const oldest = decryptedUrls.keys().next().value;
      if (!oldest) break;
      decryptedUrls.get(oldest)?.then((u) => URL.revokeObjectURL(u), () => undefined);
      decryptedUrls.delete(oldest);
      decryptedUrlSync.delete(oldest);
    }
    decryptedUrls.set(key, p);
  }
  return p;
}

/** The URL to show for an attachment, synchronously - '' while an E2EE blob is still decrypting. */
function displayUrlFor(att: AttachmentView): string {
  if (att.previewUrl) return att.previewUrl;
  if (att.encryption) return decryptedUrlSync.get(decryptedKey(att)) ?? '';
  return att.url;
}

/** The URL to actually show: local preview while sending, decrypted blob for E2EE, else the CDN. */
function useDisplayUrl(att: () => AttachmentView) {
  const [url] = createResource(att, async (a) => {
    if (a.previewUrl) return a.previewUrl;
    if (a.encryption) return decryptedUrlFor(a);
    return a.url;
  });
  return url;
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
    const url = display();
    if (!url || a.previewUrl || a.encryption) return null;
    return attachmentKind(a.contentType, a.filename) === 'audio' ? `${a.id}:${url}` : null;
  });
  const [retyped] = createResource(key, async (_key) => {
    const a = att();
    const url = display() ?? '';
    const fixed = await typedClipUrl(url, a.contentType, a.filename);
    return fixed ?? url;
  });
  return () => retyped() ?? display();
}

const UploadProgress: Component<{ att: AttachmentView }> = (props) => (
  <Show when={props.att.uploading}>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/40">
      <div class="h-full bg-primary transition-[width]" style={{ width: `${Math.round((props.att.progress ?? 0) * 100)}%` }} />
    </div>
  </Show>
);

const ImageAttachment: Component<{ att: AttachmentView; onOpen: (url: string) => void }> = (props) => {
  const url = useDisplayUrl(() => props.att);
  const [loaded, setLoaded] = createSignal(false);
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
          loading="lazy"
          decoding="async"
          class={`rounded-lg transition-opacity duration-300 ${loaded() ? 'opacity-100' : 'opacity-0'} ${
            props.att.uploading ? '!opacity-70' : ''
          } ${box() ? 'absolute inset-0 size-full object-cover' : loaded() ? 'block max-h-[300px] max-w-full object-contain' : 'absolute'}`}
        />
      </Show>
      <UploadProgress att={props.att} />
    </button>
  );
};

const VideoAttachment: Component<{ att: AttachmentView }> = (props) => {
  const url = useDisplayUrl(() => props.att);
  // The skeleton holds the exact space the player will take, so it doesn't jump in on decrypt/load.
  const box = createMemo(() => videoPlayerBox(props.att.width, props.att.height));
  return (
    <div class="relative max-w-full overflow-hidden rounded-lg" title={props.att.filename}>
      <Show
        when={url()}
        fallback={
          <div class="media-skeleton max-w-full rounded-lg" style={{ width: `${box().width}px`, height: `${box().height}px` }} />
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
  const url = usePlayableUrl(() => props.att);
  return (
    <Show when={url()} fallback={<div class="media-skeleton h-20 w-full max-w-md rounded-lg" />}>
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
  const url = usePlayableUrl(() => props.att);
  return (
    <Show when={url()} fallback={<div class="media-skeleton h-16 w-full max-w-sm rounded-lg" />}>
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
  const url = useDisplayUrl(() => props.att);
  return (
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
  const images = createMemo<MediaViewerItem[]>(() =>
    props.attachments
      .filter((a) => attachmentKind(a.contentType, a.filename) === 'image' && !a.uploading)
      .map((a) => ({
        url: displayUrlFor(a),
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        width: a.width,
        height: a.height,
      }))
      .filter((i) => !!i.url)
  );

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
                onOpen={() => {
                  const list = images();
                  const i = list.findIndex((x) => x.url === displayUrlFor(att));
                  if (i >= 0) openMediaViewer(list, i);
                }}
              />
            </Show>
          );
        }}
      </For>
    </div>
  );
};
