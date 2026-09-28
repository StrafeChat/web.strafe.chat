import type { Component } from 'solid-js';
import { presence } from '../stores/presence';
import { t } from '../i18n';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-primary',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
  invisible: 'bg-muted-foreground/50',
};

const KNOWN_STATUSES = new Set(['online', 'idle', 'dnd', 'offline', 'invisible']);

/** Localized label for a presence status (unknown values read as offline). */
export function presenceStatusLabel(status: string | undefined): string {
  return t(`presence.${status && KNOWN_STATUSES.has(status) ? status : 'offline'}`);
}

interface PresenceDotProps {
  userId: string;
  class?: string;
  title?: string;
  /** Ring color to match whatever surface the dot sits on (defaults to the page background - wrong on a card/popover surface, which is a different shade). */
  borderClass?: string;
}

/** Colored dot by status: online=green, idle=yellow, dnd=red, offline=gray. Always shows; defaults to offline when unknown. */
export const PresenceDot: Component<PresenceDotProps> = (props) => {
  const p = () => presence.byUser[props.userId];
  const status = () => p()?.status ?? 'offline';
  const titleText = () => {
    if (props.title) return props.title;
    const pres = p();
    const label = presenceStatusLabel(pres?.status);
    return pres?.custom_status ? `${label}: ${pres.custom_status}` : label;
  };
  return (
    <div
      class={`shrink-0 rounded-full border-3 ${props.borderClass ?? 'border-background'} ${
        STATUS_COLORS[status()] ?? 'bg-muted-foreground/50'
      } ${props.class ?? 'size-2.5'}`}
      title={titleText()}
      aria-hidden
    />
  );
};
