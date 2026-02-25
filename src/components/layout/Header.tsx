import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { A } from '@solidjs/router';
import { auth } from '../../stores/auth';
import { stargate } from '../../stores/stargate';

export const Header: Component = () => {
  const statusLabel = () => {
    switch (stargate.status) {
      case 'connecting':
      case 'reconnecting':
        return 'Connecting...';
      case 'connected':
        return stargate.ready ? 'Connected' : 'Connecting...';
      case 'failed':
      case 'disconnected':
        return 'Disconnected';
      default:
        return null;
    }
  };

  const statusColor = () => {
    if (stargate.status === 'connected' && stargate.ready) return 'bg-primary';
    if (stargate.status === 'failed' || stargate.status === 'disconnected') return 'bg-destructive';
    return 'bg-muted-foreground/50';
  };

  return (
    <header class="h-12 shrink-0 flex items-center gap-4 px-4 border-b border-border bg-card">
      <A href="/" class="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors">
        <span class="text-primary">S</span>
        StrafeChat
      </A>
      <div class="flex-1 max-w-md hidden sm:block">
        <input
          type="search"
          placeholder="Search..."
          class="w-full h-8 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div class="flex items-center gap-3 ml-auto">
        <Show when={statusLabel()}>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span class={`size-2 rounded-full ${statusColor()} ${stargate.status === 'connecting' || stargate.status === 'reconnecting' ? 'animate-pulse' : ''}`} />
            {statusLabel()}
          </div>
        </Show>
        <button
          type="button"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="User menu"
        >
          <div class="size-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium text-primary">
            {auth.user?.display_name?.[0] ?? auth.user?.username?.[0] ?? '?'}
          </div>
          <span class="hidden md:inline text-sm truncate max-w-24">
            {auth.user?.display_name || auth.user?.username}
          </span>
        </button>
      </div>
    </header>
  );
};
