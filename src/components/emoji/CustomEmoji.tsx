import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { resolveCustomEmoji } from '../../stores/customEmojis';

export interface CustomEmojiProps {
  id: string;
  /** Name as written in the message - shown as `:name:` if the emoji can't be resolved. */
  name: string;
  jumbo?: boolean;
  class?: string;
}

/**
 * A space custom emoji referenced as <:name:id>. Resolves through the custom-emoji store,
 * which also fetches emoji from spaces the viewer isn't in, so an emoji used in a PM by
 * a member of some other space still renders. Deleted/unknown ids degrade to `:name:`.
 */
export const CustomEmoji: Component<CustomEmojiProps> = (props) => {
  const emoji = () => resolveCustomEmoji(props.id);
  return (
    <Show
      when={emoji()}
      fallback={
        <span class={`text-muted-foreground ${props.class ?? ''}`} title="This emoji is no longer available">
          :{props.name}:
        </span>
      }
    >
      {(e) => (
        <img
          class={`emoji ${props.jumbo ? 'emoji-jumbo' : ''} ${props.class ?? ''}`}
          src={e().url}
          alt={`:${e().name}:`}
          title={`:${e().name}:`}
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      )}
    </Show>
  );
};
