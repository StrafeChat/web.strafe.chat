import type { Component } from 'solid-js';
import { Show, onMount } from 'solid-js';
import { ensureLinkPreview, linkPreviews } from '../../stores/linkPreviews';
import { isExternalLink, requestOpenExternalLink } from '../../stores/externalLink';

/**
 * A link-preview card (Discord-style): a coloured accent edge (the site's theme colour), the
 * site name + favicon, a title, a short description and a thumbnail. Only renders once the
 * server's /unfurl returned something worth showing; a bare or unreachable link shows nothing.
 * The whole card links to the (post-redirect) URL, guarded like every other external link.
 */
export const LinkPreview: Component<{ url: string }> = (props) => {
  onMount(() => ensureLinkPreview(props.url));
  const entry = () => linkPreviews.byUrl[props.url];

  return (
    <Show when={entry()?.status === 'ok' && entry()?.data}>
      {(d) => {
        const href = () => d().url || props.url;
        return (
          <a
            href={href()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!isExternalLink(href())) return;
              if (e.shiftKey) return;
              e.preventDefault();
              requestOpenExternalLink(href());
            }}
            class="mt-1.5 flex w-fit max-w-md overflow-hidden rounded-md border border-s-[3px] border-border/60 bg-card/40 no-underline transition-colors hover:bg-card/60"
            style={{ 'border-inline-start-color': d().theme_color || 'var(--color-primary)' }}
          >
            <div class="min-w-0 flex-1 p-3">
              <Show when={d().site_name}>
                <div class="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Show when={d().icon}>
                    <img src={d().icon} alt="" class="size-3.5 rounded-sm object-contain" loading="lazy" draggable={false} />
                  </Show>
                  <span class="truncate">{d().site_name}</span>
                </div>
              </Show>
              <Show when={d().title}>
                <div class="line-clamp-2 text-sm font-semibold text-primary">{d().title}</div>
              </Show>
              <Show when={d().description}>
                <p class="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground">{d().description}</p>
              </Show>
            </div>
            <Show when={d().image}>
              <img src={d().image} alt="" class="w-24 shrink-0 object-cover" loading="lazy" draggable={false} />
            </Show>
          </a>
        );
      }}
    </Show>
  );
};
