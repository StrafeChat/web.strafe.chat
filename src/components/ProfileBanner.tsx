import type { Component } from 'solid-js';
import { createEffect, createSignal, on, Show } from 'solid-js';

interface ProfileBannerProps {
  banner?: string;
  class?: string;
  fit?: 'cover' | 'natural';
}

export const ProfileBanner: Component<ProfileBannerProps> = (props) => {
  const [ratio, setRatio] = createSignal<number | null>(null);

  createEffect(
    on(
      () => props.banner,
      (banner) => {
        if (!banner) setRatio(null);
      },
      { defer: true },
    ),
  );

  return (
    <div
      class={`relative w-full overflow-hidden bg-gradient-to-br from-primary/60 via-primary/30 to-primary/10 ${props.class ?? 'h-20'}`}
      style={
        props.fit === 'natural'
          ? ratio()
            ? { 'aspect-ratio': String(ratio()) }
            : { 'min-height': '6rem' }
          : undefined
      }
    >
      <Show
        when={props.banner}
        fallback={
          <div
            class="absolute inset-0"
            style={{
              'background-image': 'radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1px)',
              'background-size': '14px 14px',
            }}
          />
        }
      >
        {(banner) => (
          <img
            src={banner()}
            alt=""
            class="absolute inset-0 size-full object-cover"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
        )}
      </Show>
    </div>
  );
};
