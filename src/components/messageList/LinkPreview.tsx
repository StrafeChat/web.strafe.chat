import type { Component, JSX } from 'solid-js';
import { Show, createMemo, createSignal, onMount } from 'solid-js';
import { ensureLinkPreview, linkPreviews } from '../../stores/linkPreviews';
import type { LinkMetadata } from '../../api/unfurl';
import { isExternalLink, requestOpenExternalLink } from '../../stores/externalLink';
import { VideoPlayer } from '../media';
import { getMediaDimensions, recordMediaDimensions } from '../../lib/mediaDimensions';
import { videoEmbed } from '../../lib/embeds/providers';
import { IframeEmbed } from './IframeEmbed';

/**
 * A preview-card image that reserves its space before the bytes load. When the size is known (from
 * the unfurl, or cached from a prior load) it holds an aspect-ratio box and fades the image in over
 * a shimmer; otherwise it shows a shimmer of a sensible height until the image arrives.
 */
const PreviewImage: Component<{ src: string; width?: number; height?: number }> = (props) => {
  const [loaded, setLoaded] = createSignal(false);
  const dims = () => {
    const w = props.width || getMediaDimensions(props.src)?.width;
    const h = props.height || getMediaDimensions(props.src)?.height;
    return w && h ? { w, h } : null;
  };
  const onLoad = (e: Event & { currentTarget: HTMLImageElement }) => {
    setLoaded(true);
    recordMediaDimensions(props.src, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
  };
  return (
    <div class="relative w-full overflow-hidden rounded" style={dims() ? { 'aspect-ratio': `${dims()!.w} / ${dims()!.h}`, 'max-height': '20rem' } : undefined}>
      <Show when={!loaded()}>
        <div class={`media-skeleton ${dims() ? 'absolute inset-0' : 'h-44 w-full'}`} />
      </Show>
      <img
        src={props.src}
        alt=""
        onLoad={onLoad}
        loading="lazy"
        decoding="async"
        class={`rounded object-cover transition-opacity duration-300 ${loaded() ? 'opacity-100' : 'opacity-0'} ${
          dims() ? 'absolute inset-0 size-full' : loaded() ? 'block max-h-80 w-full' : 'absolute'
        }`}
      />
    </div>
  );
};

/** Last path segment of a URL, a reasonable fallback name for a video with no title. */
function mediaName(href: string): string {
  try {
    const name = new URL(href).pathname.split('/').pop();
    return name ? decodeURIComponent(name) : 'video';
  } catch {
    return 'video';
  }
}

/**
 * A rich link-preview card, modelled on Discord's embed: an accent edge in the site's theme
 * colour, a provider (favicon + site name) and author line, a title, a description, and media -
 * a full-width image, a small right-hand thumbnail, or a video. A video plays inline in our own
 * player when the link is a real file, in a click-to-load provider <iframe> for an embeddable one
 * (YouTube, Vimeo, …), and otherwise falls back to a poster that opens the source. Only renders
 * once /unfurl returned something worth showing.
 */
export const LinkPreview: Component<{ url: string }> = (props) => {
  onMount(() => ensureLinkPreview(props.url));
  const entry = () => linkPreviews.byUrl[props.url];
  const data = () => (entry()?.status === 'ok' ? entry()?.data : undefined);
  const embed = createMemo(() => videoEmbed(props.url));

  // Render for real metadata, or - even without any - for an embeddable provider, so a YouTube
  // link still gets an inline player though YouTube serves our unfurl bot no preview at all.
  return (
    <Show when={data() || embed()}>
      <Card d={data() ?? {}} fallbackUrl={props.url} />
    </Show>
  );
};

const Card: Component<{ d: LinkMetadata; fallbackUrl: string }> = (props) => {
  const href = () => props.d.url || props.fallbackUrl;
  const openGuarded = (e: MouseEvent) => {
    if (!isExternalLink(href())) return;
    if (e.shiftKey) return;
    e.preventDefault();
    requestOpenExternalLink(href());
  };

  const video = () => props.d.video;
  const image = () => props.d.image;
  // A known provider (YouTube, Vimeo, …) whose page we can frame and play in-app, derived from the
  // link itself rather than the metadata - so it works even if the page didn't declare an og:video.
  const embed = createMemo(() => videoEmbed(props.d.url) || videoEmbed(props.fallbackUrl));
  // A declared video is playable in our native player only when it's a real media file, not an
  // embed page (those go through the provider iframe above, or a poster that opens the source).
  const videoPlayable = createMemo(() => {
    const v = video();
    if (!v?.url) return false;
    return (props.d.video_type ?? '').startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v.url);
  });
  // Big media (a video, an inline embed, or a large image) stacks under the text; a plain
  // "summary" image is a small thumbnail beside it.
  const bigMedia = () => !!video() || !!embed() || (!!image() && !!props.d.image_large);
  const thumbnail = () => !video() && !embed() && !!image() && !props.d.image_large;

  const textBlock = (): JSX.Element => (
    <>
      <Show when={props.d.site_name || props.d.icon}>
        <div class="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Show when={props.d.icon}>
            <img src={props.d.icon} alt="" class="size-3.5 rounded-sm object-contain" loading="lazy" draggable={false} />
          </Show>
          <span class="truncate">{props.d.site_name}</span>
        </div>
      </Show>
      <Show when={props.d.author}>
        <div class="mb-0.5 truncate text-xs font-medium text-foreground/90">{props.d.author}</div>
      </Show>
      <Show when={props.d.title}>
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openGuarded}
          class="line-clamp-2 text-sm font-semibold text-primary hover:underline"
        >
          {props.d.title}
        </a>
      </Show>
      <Show when={props.d.description}>
        <p class="mt-1 line-clamp-4 text-xs leading-snug text-muted-foreground">{props.d.description}</p>
      </Show>
    </>
  );

  const mediaBlock = (): JSX.Element => {
    // A real media file → our own player.
    const v = video();
    if (videoPlayable() && v) {
      return (
        <VideoPlayer
          src={v.url}
          filename={props.d.title || mediaName(v.url)}
          width={v.width}
          height={v.height}
          poster={image()?.url}
          class="mt-2"
        />
      );
    }
    // A known provider (YouTube, Vimeo, …) → click-to-load inline iframe.
    const e = embed();
    if (e) return <IframeEmbed embed={e} poster={image()?.url ?? e.poster} title={props.d.title} />;
    // An unknown embed page that still declared a video → poster whose click opens the source.
    if (v) {
      return (
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openGuarded}
          class="group relative mt-2 block overflow-hidden rounded bg-black/30"
        >
          <Show when={image()?.url}>
            <PreviewImage src={image()!.url} width={image()!.width} height={image()!.height} />
          </Show>
          <span class="absolute inset-0 flex items-center justify-center">
            <span class="flex size-12 items-center justify-center rounded-full bg-black/60 text-white transition-colors group-hover:bg-black/75">
              <i class="fa-solid fa-play ms-0.5" aria-hidden="true" />
            </span>
          </span>
        </a>
      );
    }
    // Otherwise a plain image.
    return (
      <a href={href()} target="_blank" rel="noopener noreferrer" onClick={openGuarded} class="mt-2 block overflow-hidden rounded">
        <PreviewImage src={image()!.url} width={image()!.width} height={image()!.height} />
      </a>
    );
  };

  return (
    <div
      class="mt-1.5 w-fit max-w-md overflow-hidden rounded-md border border-s-[3px] border-border/60 bg-card/40"
      style={{ 'border-inline-start-color': props.d.color || 'var(--color-primary)' }}
    >
      <Show
        when={thumbnail()}
        fallback={
          <div class="p-3">
            {textBlock()}
            <Show when={bigMedia()}>{mediaBlock()}</Show>
          </div>
        }
      >
        <div class="flex">
          <div class="min-w-0 flex-1 p-3">{textBlock()}</div>
          <a href={href()} target="_blank" rel="noopener noreferrer" onClick={openGuarded} class="shrink-0 self-stretch">
            <img src={image()!.url} alt="" class="h-full w-20 object-cover" loading="lazy" draggable={false} />
          </a>
        </div>
      </Show>
    </div>
  );
};
