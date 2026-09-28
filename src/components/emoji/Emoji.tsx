import type { Component } from 'solid-js';
import { Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import { appearance } from '../../stores/appearance';
import { getEmojiProvider } from '../../lib/emoji/providers';
import { shortcodeFor } from '../../lib/emoji/data';

export interface EmojiProps {
  /** A single emoji sequence. */
  emoji: string;
  /** Large rendering for emoji-only messages. */
  jumbo?: boolean;
  class?: string;
  title?: string;
}

/**
 * One Unicode emoji, drawn by the user's chosen image provider (Twemoji by default) with
 * the native glyph as the fallback when the provider is 'native' or the image 404s
 * (brand-new emoji a set hasn't drawn yet, for instance).
 */
export const Emoji: Component<EmojiProps> = (props) => {
  const [failed, setFailed] = createSignal(false);
  const url = createMemo(() => {
    const p = getEmojiProvider(appearance.emojiProvider);
    return p.imageUrl ? p.imageUrl(props.emoji) : null;
  });
  // A different provider may well have the image the last one lacked.
  createEffect(on(url, () => setFailed(false), { defer: true }));
  const title = () => {
    if (props.title) return props.title;
    const code = shortcodeFor(props.emoji);
    return code ? `:${code}:` : undefined;
  };

  return (
    <Show
      when={url() && !failed()}
      fallback={
        <span class={`emoji-native ${props.jumbo ? 'emoji-jumbo' : ''} ${props.class ?? ''}`} title={title()}>
          {props.emoji}
        </span>
      }
    >
      <img
        class={`emoji ${props.jumbo ? 'emoji-jumbo' : ''} ${props.class ?? ''}`}
        src={url()!}
        alt={props.emoji}
        title={title()}
        draggable={false}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </Show>
  );
};
