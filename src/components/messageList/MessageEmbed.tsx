import type { Component } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import type { Embed, EmbedImage } from '../../api/messages';
import type { RoomParticipant } from '../../api/rooms';
import type { SpaceRole } from '../../api/spaces';
import { MessageBody, guardClick } from './MessageBody';
import { EmbedShell } from './LinkPreview';
import { Button } from '../ui/Button';
import { appearance } from '../../stores/appearance';
import { openMediaViewer } from '../../stores/mediaViewer';
import { fitWithin } from '../../lib/attachments/format';
import { getMediaDimensions, recordMediaDimensions } from '../../lib/mediaDimensions';
import { formatMessageTimestamp } from '../../lib/utils/datetime';
import {
  embedColorHex,
  embedHasContent,
  embedImageSrc,
  maybeAnimated,
  placeFields,
  safeHttpUrl,
  urlHost,
} from '../../lib/embeds/messageEmbeds';
import { t } from '../../i18n';

/** Discord's sizes: the big picture fits 400x300, the thumbnail 80x80. */
const IMAGE_MAX_W = 400;
const IMAGE_MAX_H = 300;
const THUMB_MAX = 80;

export interface MessageEmbedsProps {
  embeds: Embed[];
  /** Resolve `<@id>` in descriptions and field values (rendered, never notifying). */
  participants?: RoomParticipant[];
  spaceRoles?: SpaceRole[];
  onMentionClick?: (userId: string, anchor: HTMLElement) => void;
}

/**
 * A bot's rich embeds, one card each, under the message text and its attachments (Discord's
 * order). Only plain rooms carry them; the caller also checks the room and the reader's
 * "Show embeds from bots" setting.
 */
export const MessageEmbeds: Component<MessageEmbedsProps> = (props) => {
  const shown = createMemo(() => props.embeds.filter(embedHasContent));
  return (
    <div class="flex min-w-0 flex-col gap-1">
      <For each={shown()}>
        {(embed) => (
          <EmbedCard
            embed={embed}
            participants={props.participants}
            spaceRoles={props.spaceRoles}
            onMentionClick={props.onMentionClick}
          />
        )}
      </For>
    </div>
  );
};

const EmbedCard: Component<{
  embed: Embed;
  participants?: RoomParticipant[];
  spaceRoles?: SpaceRole[];
  onMentionClick?: (userId: string, anchor: HTMLElement) => void;
}> = (props) => {
  const e = () => props.embed;
  // No colour is a neutral edge, as on Discord - not the brand colour a link preview borrows.
  const color = () => embedColorHex(e().color) ?? 'var(--color-border)';
  const titleHref = () => safeHttpUrl(e().url);
  const authorHref = () => safeHttpUrl(e().author?.url);
  const authorIcon = () => embedImageSrc(e().author?.icon_url, e().author?.proxy_icon_url);
  const footerIcon = () => embedImageSrc(e().footer?.icon_url, e().footer?.proxy_icon_url);
  const image = () => (e().image?.url ? e().image : undefined);
  const thumbnail = () => (e().thumbnail?.url ? e().thumbnail : undefined);
  const fields = () => (e().fields ?? []).filter((f) => f && (f.name || f.value));
  const placements = createMemo(() => placeFields(fields(), !!thumbnail()));
  const stamp = createMemo(() => {
    const raw = e().timestamp;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  });

  /** A picture opens the app's viewer, labelled with what the embed calls itself. */
  const openPicture = (src: string, width?: number, height?: number) =>
    openMediaViewer([{ url: src, filename: e().title || urlHost(src) || t('messages.embed.image'), width, height }], 0, e().author?.name || undefined);

  const body = (text: string, styleOnly?: boolean, cls?: string) => (
    <MessageBody
      text={text}
      class={cls}
      embedded
      styleOnly={styleOnly}
      participants={props.participants}
      spaceRoles={props.spaceRoles}
      onMentionClick={props.onMentionClick}
    />
  );

  return (
    <EmbedShell color={color()} class="w-fit max-w-[min(32.5rem,100%)]" label={e().title || e().author?.name || t('messages.embed.label')}>
      <div class="p-3 pe-4">
        <div class="flex gap-4">
          <div class="min-w-0 flex-1">
            <Show when={e().author?.name}>
              {(name) => (
                <div class="mb-1.5 flex min-w-0 items-center gap-2">
                  <Show when={authorIcon()}>{(src) => <EmbedIcon src={src()} size={24} class="size-6" />}</Show>
                  <Show when={authorHref()} fallback={<span class="min-w-0 truncate text-sm font-semibold text-foreground">{name()}</span>}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={guardClick(href())}
                        class="min-w-0 truncate text-sm font-semibold text-foreground hover:underline"
                      >
                        {name()}
                      </a>
                    )}
                  </Show>
                </div>
              )}
            </Show>
            <Show when={e().title}>
              {(title) => (
                <div class="mb-1 break-words text-[15px] font-semibold leading-snug text-foreground">
                  <Show when={titleHref()} fallback={body(title(), true)}>
                    {(href) => (
                      <a href={href()} target="_blank" rel="noopener noreferrer" onClick={guardClick(href())} class="text-primary hover:underline">
                        {body(title(), true, 'inline')}
                      </a>
                    )}
                  </Show>
                </div>
              )}
            </Show>
            <Show when={e().description}>
              {(description) => <div class="break-words text-sm leading-snug text-foreground/90">{body(description())}</div>}
            </Show>
            <Show when={fields().length > 0}>
              <div class="mt-2 grid grid-cols-12 gap-x-4 gap-y-2">
                <For each={fields()}>
                  {(field, i) => (
                    <div class="min-w-0 break-words" style={{ 'grid-column': placements()[i()]?.column ?? '1 / -1' }}>
                      <div class="mb-0.5 text-sm font-semibold text-foreground">{body(field.name, true)}</div>
                      <div class="text-sm leading-snug text-foreground/90">{body(field.value)}</div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <Show when={thumbnail()}>
            {(thumb) => (
              <div class="shrink-0">
                <EmbedPicture image={thumb()} thumb onOpen={openPicture} />
              </div>
            )}
          </Show>
        </div>
        <Show when={image()}>
          {(img) => (
            <div class="mt-3">
              <EmbedPicture image={img()} onOpen={openPicture} />
            </div>
          )}
        </Show>
        <Show when={e().footer?.text || stamp()}>
          <div class="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Show when={e().footer?.text && footerIcon()}>{(src) => <EmbedIcon src={src()} size={20} class="size-5" />}</Show>
            <span class="min-w-0 break-words">
              {e().footer?.text}
              <Show when={e().footer?.text && stamp()}>
                <span aria-hidden="true"> • </span>
              </Show>
              <Show when={stamp()}>{(d) => <time datetime={d().toISOString()}>{formatMessageTimestamp(d())}</time>}</Show>
            </span>
          </div>
        </Show>
      </div>
    </EmbedShell>
  );
};

/**
 * An embed's picture: the instance's copy when there is one, otherwise a placeholder that loads
 * the original only when the reader asks, having said what that tells the other site.
 */
const EmbedPicture: Component<{
  image: EmbedImage;
  thumb?: boolean;
  onOpen: (src: string, width?: number, height?: number) => void;
}> = (props) => {
  const [optedIn, setOptedIn] = createSignal(false);
  const src = () => embedImageSrc(props.image.url, props.image.proxy_url) ?? (optedIn() ? safeHttpUrl(props.image.url) : undefined);
  return (
    <Show when={src()} fallback={<ExternalImageGate url={props.image.url} thumb={props.thumb} onLoad={() => setOptedIn(true)} />}>
      {(s) => (
        <PictureFrame
          src={s()}
          source={props.image.url}
          width={props.image.width}
          height={props.image.height}
          thumb={props.thumb}
          onOpen={(w, h) => props.onOpen(s(), w, h)}
        />
      )}
    </Show>
  );
};

/**
 * Draws a loaded picture's first frame onto a canvas, at no more than the size it is shown at in
 * device pixels (`box`, CSS pixels, filled the way the canvas's object-fit fills it), so holding
 * a large picture still costs no more memory than the picture on screen.
 */
function drawFirstFrame(img: HTMLImageElement, canvas: HTMLCanvasElement, box: { width: number; height: number }, fit: 'contain' | 'cover') {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(box.width, canvas.clientWidth) * dpr;
  const h = Math.max(box.height, canvas.clientHeight) * dpr;
  const scale = Math.min(1, fit === 'cover' ? Math.max(w / nw, h / nh) : Math.min(w / nw, h / nh));
  canvas.width = Math.max(1, Math.round(nw * scale));
  canvas.height = Math.max(1, Math.round(nh * scale));
  try {
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  } catch {
    // Nothing to hold still with; the picture shows as it is.
  }
}

/**
 * An author or footer icon. For a reader who asked for reduced motion it is held on its first
 * frame, as the pictures are (an icon can animate whatever its URL says).
 */
const EmbedIcon: Component<{
  src: string;
  /** The size it is shown at, CSS pixels (`class` sets it). */
  size: number;
  class: string;
}> = (props) => {
  const [loaded, setLoaded] = createSignal(false);
  let img: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const still = () => appearance.reduceMotion;
  const draw = () => {
    if (img && canvas) drawFirstFrame(img, canvas, { width: props.size, height: props.size }, 'cover');
  };
  createEffect(() => {
    if (still() && loaded()) draw();
  });
  return (
    <span class={`relative shrink-0 overflow-hidden rounded-full ${props.class}`}>
      <img
        ref={(el) => (img = el)}
        src={props.src}
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        draggable={false}
        onLoad={() => setLoaded(true)}
        class={`block size-full object-cover ${still() ? 'opacity-0' : ''}`}
      />
      <Show when={still()}>
        <canvas
          ref={(el) => {
            canvas = el;
            queueMicrotask(draw);
          }}
          aria-hidden="true"
          class="absolute inset-0 size-full object-cover"
        />
      </Show>
    </span>
  );
};

/**
 * The picture itself. Reserves its box from the size the server learned (or one cached from an
 * earlier load) so the card does not jump, fades in over a shimmer, and disappears if the bytes
 * never come. For a reader who asked for reduced motion every picture is held on its first frame
 * and plays while hovered or focused: any of them may animate, since the proxy serves whatever
 * bytes it finds (an extensionless URL, an APNG named .png). The GIF badge is only on one whose
 * URL names an animated format.
 */
const PictureFrame: Component<{
  src: string;
  /** The bot's original URL: whether it names an animated format decides the GIF badge. */
  source: string;
  width?: number;
  height?: number;
  thumb?: boolean;
  onOpen: (width?: number, height?: number) => void;
}> = (props) => {
  const [loaded, setLoaded] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const [active, setActive] = createSignal(false);
  let img: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;

  const maxW = () => (props.thumb ? THUMB_MAX : IMAGE_MAX_W);
  const maxH = () => (props.thumb ? THUMB_MAX : IMAGE_MAX_H);
  const box = createMemo(() => {
    const w = props.width || getMediaDimensions(props.src)?.width;
    const h = props.height || getMediaDimensions(props.src)?.height;
    return w && h ? fitWithin(w, h, maxW(), maxH()) : null;
  });
  const still = () => appearance.reduceMotion;
  const playing = () => !still() || active();

  const drawStill = () => {
    if (img && canvas) drawFirstFrame(img, canvas, box() ?? { width: maxW(), height: maxH() }, 'contain');
  };
  createEffect(() => {
    if (still() && loaded()) drawStill();
  });

  const onLoad = () => {
    setLoaded(true);
    if (img) recordMediaDimensions(props.src, img.naturalWidth, img.naturalHeight);
  };

  const unsized = () => (props.thumb ? 'size-20' : 'h-44 w-64 max-w-full');
  const sized = () => (props.thumb ? 'block max-h-20 max-w-20 object-contain' : 'block max-h-[300px] max-w-full object-contain');

  return (
    <Show when={!failed()}>
      <button
        type="button"
        class="relative block max-w-full cursor-zoom-in overflow-hidden rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={box() ? { width: `${box()!.width}px`, height: `${box()!.height}px` } : undefined}
        aria-label={t('messages.embed.openImage')}
        onClick={() => props.onOpen(img?.naturalWidth || undefined, img?.naturalHeight || undefined)}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <Show when={!loaded()}>
          <div class={`media-skeleton ${box() ? 'absolute inset-0' : unsized()}`} />
        </Show>
        <img
          ref={(el) => (img = el)}
          src={props.src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          draggable={false}
          onLoad={onLoad}
          onError={() => setFailed(true)}
          class={`rounded transition-opacity duration-300 ${loaded() && playing() ? 'opacity-100' : 'opacity-0'} ${
            box() ? 'absolute inset-0 size-full object-contain' : loaded() ? sized() : 'absolute'
          }`}
        />
        <Show when={still()}>
          <canvas
            ref={(el) => {
              canvas = el;
              queueMicrotask(drawStill);
            }}
            aria-hidden="true"
            class={`absolute inset-0 size-full rounded object-contain ${loaded() && !active() ? '' : 'invisible'}`}
          />
          <Show when={!props.thumb && loaded() && !active() && maybeAnimated(props.source)}>
            <span class="pointer-events-none absolute bottom-1.5 start-1.5 rounded bg-black/65 px-1 py-px text-[10px] font-semibold text-white">
              {t('gif.item')}
            </span>
          </Show>
        </Show>
      </button>
    </Show>
  );
};

/**
 * In place of a picture the instance has no copy of (its image proxy is off): the site's name,
 * and what loading it would tell that site. Nothing is fetched until the reader says so.
 */
const ExternalImageGate: Component<{ url: string; thumb?: boolean; onLoad: () => void }> = (props) => {
  const host = () => urlHost(props.url);
  return (
    <Show when={safeHttpUrl(props.url) && host()}>
      <Show
        when={!props.thumb}
        fallback={
          <button
            type="button"
            class="flex size-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            title={`${t('messages.embed.externalImage', { host: host() })} - ${t('messages.embed.externalImageWarning')}`}
            aria-label={`${t('messages.embed.loadImage')}: ${t('messages.embed.externalImage', { host: host() })}. ${t('messages.embed.externalImageWarning')}`}
            onClick={() => props.onLoad()}
          >
            <i class="fa-solid fa-image" aria-hidden="true" />
            <span class="max-w-full truncate px-1 text-[10px]">{host()}</span>
          </button>
        }
      >
        <div class="flex max-w-sm items-center gap-3 rounded border border-dashed border-border bg-muted/20 p-3">
          <i class="fa-solid fa-image shrink-0 text-lg text-muted-foreground" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{t('messages.embed.externalImage', { host: host() })}</div>
            <div class="text-xs text-muted-foreground">{t('messages.embed.externalImageWarning')}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => props.onLoad()}>
            {t('messages.embed.loadImage')}
          </Button>
        </div>
      </Show>
    </Show>
  );
};
