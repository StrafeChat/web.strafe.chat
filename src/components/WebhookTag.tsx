import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { t } from '../i18n';
import type { BridgedIdentity } from '../lib/webhookMessages';
import { bridgePlatformLabel } from '../lib/bridgePlatforms';

/** What the tag needs to know: `true` (a plain webhook), or a sender display's `webhook`. */
export type WebhookTagSubject = boolean | { kind: 'webhook' | 'bridge'; bridge?: BridgedIdentity } | null | undefined;

/**
 * The tag after a webhook's or a bridged person's name, so a reader always knows it is not a
 * Strafe account:
 *
 * - a webhook message: the WEBHOOK tag, drawn like the BOT tag (identity, not flair);
 * - a bridged message: the platform ("DISCORD", "MATRIX", or the bridge's own platform name)
 *   with a small bridge glyph, in a neutral colour so it can't pass for a role pill. Its
 *   tooltip and accessible name say who bridged it ("Bridged from Discord by Strife").
 *
 * Renders nothing for an ordinary message, so it can be placed unconditionally next to BotTag.
 */
export const WebhookTag: Component<{ webhook?: WebhookTagSubject; size?: 'xs' | 'sm' | 'md'; class?: string }> = (props) => {
  const sizing = () =>
    props.size === 'md'
      ? 'h-[19px] px-[7px] text-[11px]'
      : props.size === 'xs'
        ? 'h-[15px] px-[5px] text-[9.5px]'
        : 'h-[17px] px-[6px] text-[10.5px]';
  const bridge = () => {
    const w = props.webhook;
    return w && typeof w === 'object' && w.kind === 'bridge' ? (w.bridge ?? { bridgeId: '', platform: 'other' }) : null;
  };
  const platform = () => {
    const b = bridge();
    return b ? bridgePlatformLabel(b.platform, b.platformName) : '';
  };
  const bridgeLabel = () => {
    const b = bridge();
    if (!b) return '';
    const via = b.via?.name || b.bridgeName || '';
    return via ? t('bridges.tagLabelVia', { platform: platform(), via }) : t('bridges.tagLabel', { platform: platform() });
  };
  const base = () =>
    `ms-1.5 inline-flex shrink-0 select-none items-center self-center rounded-[4px] align-middle font-semibold uppercase leading-none tracking-[0.02em] ${sizing()} ${props.class ?? ''}`;

  return (
    <Show when={props.webhook}>
      <Show
        when={bridge()}
        fallback={
          <span class={`${base()} bg-primary text-white`} title={t('badges.webhook')} aria-label={t('badges.webhook')}>
            {t('badges.webhookTag')}
          </span>
        }
      >
        <span
          class={`${base()} gap-1 bg-muted-foreground/20 text-foreground/80 ring-1 ring-inset ring-border`}
          title={bridgeLabel()}
          aria-label={bridgeLabel()}
          data-bridge-tag
        >
          <i class="fa-solid fa-bridge text-[0.85em] opacity-80" aria-hidden="true" />
          <span class="max-w-[10rem] truncate">{platform()}</span>
        </span>
      </Show>
    </Show>
  );
};
