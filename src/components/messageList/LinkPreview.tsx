import type { Component, JSX } from 'solid-js';
import { Show, createMemo, onMount } from 'solid-js';
import { ensureLinkPreview, linkPreviews } from '../../stores/linkPreviews';
import type { LinkMetadata } from '../../api/unfurl';
import { isExternalLink, requestOpenExternalLink } from '../../stores/externalLink';

/**
 * A rich link-preview card, modelled on Discord's embed: an accent edge in the site's theme
 * colour, a provider (favicon + site name) and author line, a title, a description, and media -
 * a full-width image, a small right-hand thumbnail, or a video (played inline when the link is a
 * real file, else the poster with a play affordance that opens the source). Only renders once
 * /unfurl returned something worth showing.
 */
export const LinkPreview: Component<{ url: string }> = (props) => {
  onMount(() => ensureLinkPreview(props.url));
  const entry = () => linkPreviews.byUrl[props.url];

  return (
    <Show when={entry()?.status === 'ok' && entry()?.data}>
      {(data) => <Card d={data()} fallbackUrl={props.url} />}
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
  // A video is playable inline only when it's a real media file, not an embed page (YouTube).
  const videoPlayable = createMemo(() => {
    const v = video();
    if (!v?.url) return false;
    return (props.d.video_type ?? '').startsWith('video/') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v.url);
  });
  // Big media (video or a large image) stacks under the text; a plain "summary" image is a small
  // thumbnail beside it.
  const bigMedia = () => !!video() || (!!image() && !!props.d.image_large);
  const thumbnail = () => !video() && !!image() && !props.d.image_large;

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

  const mediaBlock = (): JSX.Element => (
    <Show
      when={video()}
      fallback={
        <a href={href()} target="_blank" rel="noopener noreferrer" onClick={openGuarded} class="mt-2 block overflow-hidden rounded">
          <img src={image()!.url} alt="" class="max-h-80 w-full rounded object-cover" loading="lazy" draggable={false} />
        </a>
      }
    >
      {(v) => (
        <Show
          when={videoPlayable()}
          fallback={
            // An embed-only video (e.g. YouTube): poster + play badge; click opens the source.
            <a
              href={href()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openGuarded}
              class="group relative mt-2 block overflow-hidden rounded bg-black/30"
            >
              <Show when={image()?.url}>
                <img src={image()!.url} alt="" class="max-h-80 w-full rounded object-cover" loading="lazy" draggable={false} />
              </Show>
              <span class="absolute inset-0 flex items-center justify-center">
                <span class="flex size-12 items-center justify-center rounded-full bg-black/60 text-white transition-colors group-hover:bg-black/75">
                  <i class="fa-solid fa-play ms-0.5" aria-hidden="true" />
                </span>
              </span>
            </a>
          }
        >
          <video controls preload="metadata" poster={image()?.url} class="mt-2 max-h-80 w-full rounded bg-black/30">
            <source src={v().url} type={props.d.video_type || undefined} />
          </video>
        </Show>
      )}
    </Show>
  );

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
