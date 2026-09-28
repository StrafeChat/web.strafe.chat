import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { badgesFor } from '../lib/badges';
import { t } from '../i18n';

export interface UserBadgesProps {
  /** The user's badge bitfield (public_flags). */
  flags?: number;
  /** Bot accounts get a distinct tag rather than a bit badge. */
  bot?: boolean;
  /** Icon size in px. */
  size?: number;
  class?: string;
}

/**
 * The row of profile badges, drawn from a public_flags bitfield plus the bot flag. Each is
 * an icon in its badge colour with a tooltip naming it; nothing renders when there are none.
 */
export const UserBadges: Component<UserBadgesProps> = (props) => {
  const list = () => badgesFor(props.flags);
  const px = () => props.size ?? 15;
  return (
    <Show when={list().length > 0 || props.bot}>
      <span class={`inline-flex flex-wrap items-center gap-1 ${props.class ?? ''}`}>
        <For each={list()}>
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
        <Show when={props.bot}>
          <span
            class="inline-flex items-center rounded-[5px] bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-primary-foreground"
            title={t('badges.bot')}
          >
            {t('badges.botTag')}
          </span>
        </Show>
      </span>
    </Show>
  );
};
