import type { Component } from 'solid-js';
import { t } from '../i18n';

/**
 * The BOT tag that sits right after a bot account's name - in message headers, member
 * lists, profiles, pickers, everywhere a bot is named - so a bot is never mistaken for a
 * person. Deliberately not part of the badge row: badges are optional flair, this is
 * identity. Renders nothing for people, so it can be placed unconditionally.
 *
 * Drawn the way Discord draws its APP tag: a small solid rounded rectangle, vertically
 * centred on the name's line box (self-center in a flex row, align-middle inline), with
 * enough horizontal padding that the letters don't touch the edges.
 */
export const BotTag: Component<{ bot?: boolean; size?: 'xs' | 'sm' | 'md'; class?: string }> = (props) => {
  const sizing = () =>
    props.size === 'md'
      ? 'h-[19px] px-[7px] text-[11px]'
      : props.size === 'xs'
        ? 'h-[15px] px-[5px] text-[9.5px]'
        : 'h-[17px] px-[6px] text-[10.5px]';
  return (
    <>
      {props.bot ? (
        <span
          class={`ms-1.5 inline-flex shrink-0 select-none items-center self-center rounded-[4px] bg-primary align-middle font-semibold uppercase leading-none tracking-[0.02em] text-white ${sizing()} ${props.class ?? ''}`}
          title={t('badges.bot')}
          aria-label={t('badges.bot')}
        >
          {t('badges.botTag')}
        </span>
      ) : null}
    </>
  );
};
