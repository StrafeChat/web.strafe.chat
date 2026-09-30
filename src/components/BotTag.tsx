import type { Component } from 'solid-js';
import { t } from '../i18n';

/**
 * The BOT tag that sits right after a bot account's name - in message headers, member
 * lists, profiles, pickers, everywhere a bot is named - so a bot is never mistaken for a
 * person. Deliberately not part of the badge row: badges are optional flair, this is
 * identity. Renders nothing for people, so it can be placed unconditionally.
 */
export const BotTag: Component<{ bot?: boolean; size?: 'xs' | 'sm' | 'md'; class?: string }> = (props) => {
  const sizing = () =>
    props.size === 'md'
      ? 'h-[18px] px-1.5 text-[11px]'
      : props.size === 'xs'
        ? 'h-[13px] px-1 text-[8px]'
        : 'h-[15px] px-1 text-[9px]';
  return (
    <>
      {props.bot ? (
        <span
          class={`ms-1 inline-flex shrink-0 select-none items-center rounded-[4px] bg-primary align-middle font-bold uppercase leading-none tracking-[0.06em] text-primary-foreground ${sizing()} ${props.class ?? ''}`}
          title={t('badges.bot')}
          aria-label={t('badges.bot')}
        >
          {t('badges.botTag')}
        </span>
      ) : null}
    </>
  );
};
