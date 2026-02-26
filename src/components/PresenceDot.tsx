import type { Component } from 'solid-js';
import { presence } from '../stores/presence';

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-muted-foreground/50',
  invisible: 'bg-muted-foreground/50',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
  invisible: 'Invisible',
};

interface PresenceDotProps {
  userId: string;
  class?: string;
  title?: string;
}

/** Colored dot by status: online=green, idle=yellow, dnd=red, offline=gray. Always shows; defaults to offline when unknown. */
export const PresenceDot: Component<PresenceDotProps> = (props) => {
  const p = () => presence.byUser[props.userId];
  const status = () => p()?.status ?? 'offline';
  const titleText = () => {
    if (props.title) return props.title;
    const pres = p();
    const label = STATUS_LABELS[pres?.status ?? ''] ?? 'Offline';
    return pres?.custom_status ? `${label}: ${pres.custom_status}` : label;
  };
  return (
    <div
      class={`shrink-0 rounded-full border-3 border-background ${
        STATUS_COLORS[status()] ?? 'bg-muted-foreground/50'
      } ${props.class ?? 'size-2.5'}`}
      title={titleText()}
      aria-hidden
    />
  );
};
