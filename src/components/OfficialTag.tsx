import type { Component } from 'solid-js';
import { t } from '../i18n';

/**
 * The OFFICIAL tag after the instance's official account's name - in the direct message it
 * sends, its header and its sidebar entry - so a moderation or system notice is never
 * mistaken for a message from a person. Like BotTag it is identity, not optional flair, and
 * renders nothing for everyone else, so it can be placed unconditionally next to a name.
 */
export const OfficialTag: Component<{ system?: boolean; size?: 'xs' | 'sm' | 'md'; class?: string }> = (props) => {
  const sizing = () =>
    props.size === 'md'
      ? 'h-[19px] px-[7px] text-[11px]'
      : props.size === 'xs'
        ? 'h-[15px] px-[5px] text-[9.5px]'
        : 'h-[17px] px-[6px] text-[10.5px]';
  return (
    <>
      {props.system ? (
        <span
          class={`ms-1.5 inline-flex shrink-0 select-none items-center gap-1 self-center rounded-[4px] bg-emerald-600 align-middle font-semibold uppercase leading-none tracking-[0.02em] text-white ${sizing()} ${props.class ?? ''}`}
          title={t('badges.official')}
          aria-label={t('badges.official')}
        >
          <i class="fa-solid fa-circle-check text-[0.85em]" aria-hidden="true" />
          {t('badges.officialTag')}
        </span>
      ) : null}
    </>
  );
};
