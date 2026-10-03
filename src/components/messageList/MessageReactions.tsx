import type { Component } from 'solid-js';
import { For, Show, createSignal } from 'solid-js';
import { listReactors, type MessageReaction, type Reactor } from '../../api/messages';
import { resolveCustomEmoji } from '../../stores/customEmojis';
import { Emoji } from '../emoji/Emoji';
import { Tooltip } from '../ui/Tooltip';
import { t } from '../../i18n';

const CUSTOM_PREFIX = 'custom:';

function reactorLabel(users: Reactor[]): string {
  const names = users.map((u) => u.display_name || u.username);
  if (names.length <= 3) return names.join(', ');
  return t('messages.reactions.andOthers', { names: names.slice(0, 3).join(', '), count: names.length - 3 });
}

const ReactionPill: Component<{
  roomId: string;
  messageId: string;
  reaction: MessageReaction;
  /** False when the viewer lacks Add Reactions in this room - they can still remove their
   * own existing reaction (mine === true), just can't add a new one. */
  canReact: boolean;
  onToggle: (emoji: string, currentlyMine: boolean) => void;
}> = (props) => {
  const [reactors, setReactors] = createSignal<Reactor[] | null>(null);
  const [loading, setLoading] = createSignal(false);

  function loadReactors() {
    if (reactors() || loading()) return;
    setLoading(true);
    listReactors(props.roomId, props.messageId, props.reaction.emoji)
      .then(setReactors)
      .catch(() => setReactors([]))
      .finally(() => setLoading(false));
  }

  const isCustom = () => props.reaction.emoji.startsWith(CUSTOM_PREFIX);
  const customEmoji = () => (isCustom() ? resolveCustomEmoji(props.reaction.emoji.slice(CUSTOM_PREFIX.length)) : undefined);
  const emojiName = () => (isCustom() ? customEmoji()?.name ?? '' : props.reaction.emoji);

  const label = () => {
    const list = reactors();
    if (loading() && !list) return t('common.loading');
    if (!list || list.length === 0) return `:${emojiName()}:`;
    return t('messages.reactions.tooltip', { names: reactorLabel(list), emoji: `:${emojiName()}:` });
  };

  const canClick = () => props.canReact || props.reaction.me;

  return (
    <Tooltip inline side="top" label={label()}>
      <button
        type="button"
        disabled={!canClick()}
        class={`flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors ${
          props.reaction.me
            ? 'border-primary/60 bg-primary/15 text-primary'
            : canClick()
              ? 'border-border/70 bg-card/40 text-foreground hover:bg-accent/60'
              : 'cursor-not-allowed border-border/50 bg-card/20 text-muted-foreground'
        }`}
        onClick={() => canClick() && props.onToggle(props.reaction.emoji, props.reaction.me)}
        onMouseEnter={loadReactors}
        onFocus={loadReactors}
      >
        <Show when={isCustom()} fallback={<Emoji emoji={props.reaction.emoji} noTitle class="!m-0 !size-3.5" />}>
          <Show when={customEmoji()} fallback={<span class="size-3.5" />}>
            <img src={customEmoji()!.url} alt={emojiName()} class="size-3.5 object-contain" draggable={false} loading="lazy" />
          </Show>
        </Show>
        <span class="tabular-nums leading-none">{props.reaction.count}</span>
      </button>
    </Tooltip>
  );
};

/** Reaction pill row shown under a message's content, Discord-style: click a pill to toggle
 * your own reaction, hover for who reacted. */
export const MessageReactions: Component<{
  roomId: string;
  messageId: string;
  reactions: MessageReaction[];
  /** False when the viewer lacks Add Reactions in this room. Default true. */
  canReact?: boolean;
  onToggle: (emoji: string, currentlyMine: boolean) => void;
}> = (props) => (
  <div class="mt-1 flex flex-wrap gap-1">
    <For each={props.reactions}>
      {(r) => (
        <ReactionPill
          roomId={props.roomId}
          messageId={props.messageId}
          reaction={r}
          canReact={props.canReact !== false}
          onToggle={props.onToggle}
        />
      )}
    </For>
  </div>
);
