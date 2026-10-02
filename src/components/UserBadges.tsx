import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { badgesFor } from '../lib/badges';
import { t } from '../i18n';

export interface UserBadgesProps {
  /** The user's badge bitfield (public_flags). */
  flags?: number;
  /** Icon size in px. */
  size?: number;
  /**
   * Stop after this many and fold the rest into a `+N` chip, whose tooltip names every one
   * that got folded. Without it a heavily-badged account grows an unbounded row that pushes
   * the name out of the space it has.
   */
  max?: number;
  class?: string;
}

/**
 * The row of profile badges drawn from a public_flags bitfield. Each is an icon in its
 * badge colour with a tooltip naming it; nothing renders when there are none. The BOT tag
 * is not a badge - it is `BotTag`, placed right after the name.
 *
 * Badges are decoration, so they are the thing that gives way when there isn't room: `max`
 * exists so the name always keeps the line it is on.
 */
export const UserBadges: Component<UserBadgesProps> = (props) => {
  const list = () => badgesFor(props.flags);
  const px = () => props.size ?? 15;
  const shown = () => {
    const all = list();
    return props.max != null && all.length > props.max ? all.slice(0, props.max) : all;
  };
  const folded = () => {
    const all = list();
    return props.max == null || all.length <= props.max ? [] : all.slice(props.max);
  };
  const foldedLabel = () => folded().map((b) => t(`badges.${b.id}`)).join(', ');
  return (
    <Show when={list().length > 0}>
      <span class={`inline-flex flex-wrap items-center gap-1 ${props.class ?? ''}`}>
        <For each={shown()}>
          {(b) => {
            const label = t(`badges.${b.id}`);
            return (
              <span
                class="inline-flex items-center justify-center rounded-[5px] bg-muted/50 px-1 py-0.5"
                title={label}
                aria-label={label}
                role="img"
              >
                <i class={`fa-solid ${b.icon}`} style={{ color: b.color, 'font-size': `${px()}px` }} aria-hidden="true" />
              </span>
            );
          }}
        </For>
        <Show when={folded().length > 0}>
          <span
            class="inline-flex items-center justify-center rounded-[5px] bg-muted/60 px-1 text-[11px] font-semibold tabular-nums text-muted-foreground"
            title={foldedLabel()}
            aria-label={foldedLabel()}
            role="img"
          >
            +{folded().length}
          </span>
        </Show>
      </span>
    </Show>
  );
};