import type { Component } from 'solid-js';
import { Show, createSignal } from 'solid-js';
import type { VideoEmbed } from '../../lib/embeds/providers';
import { t } from '../../i18n';

/**
 * Click-to-load inline player for an embeddable provider (YouTube, Vimeo, …). Until the user
 * presses play it's just the poster with a play badge - only the click mounts the provider's
 * <iframe>, so a screen full of cards doesn't each phone home, and nothing loads in an encrypted
 * room the viewer hasn't opted into previews for. The frame is confined to the hosts allow-listed
 * in the page CSP's `frame-src`, and `referrerpolicy` keeps the full chat URL out of the request.
 */
export const IframeEmbed: Component<{ embed: VideoEmbed; poster?: string; title?: string }> = (props) => {
  const [active, setActive] = createSignal(false);
  const label = () => `${t('attachments.player.play')} · ${props.embed.provider}`;
  return (
    <div
      class={`relative mt-2 max-w-full overflow-hidden rounded bg-black ${props.embed.portrait ? 'w-[236px]' : 'w-[400px]'}`}
      style={{ 'aspect-ratio': props.embed.portrait ? '9 / 16' : '16 / 9' }}
    >
      <Show
        when={active()}
        fallback={
          <button
            type="button"
            class="group absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={label()}
            title={label()}
            onClick={() => setActive(true)}
          >
            <Show when={props.poster}>
              <img src={props.poster} alt="" class="absolute inset-0 size-full object-cover" loading="lazy" draggable={false} />
            </Show>
            <span class="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/10" />
            <span class="relative flex size-14 items-center justify-center rounded-full bg-black/65 text-white shadow-lg transition-transform group-hover:scale-105 group-hover:bg-black/80">
              <i class="fa-solid fa-play ms-1 text-xl" aria-hidden="true" />
            </span>
            <span class="absolute bottom-1.5 end-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
              {props.embed.provider}
            </span>
          </button>
        }
      >
        <iframe
          src={props.embed.src}
          class="absolute inset-0 size-full border-0"
          allow={props.embed.allow}
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
          title={props.title || props.embed.provider}
        />
      </Show>
    </div>
  );
};
