import type { Component } from 'solid-js';
import { auth } from '../../stores/auth';

export const UserArea: Component = () => {
  return (
    <div class="px-3 py-2 border-t border-border bg-[hsl(0_0%_7%)]">
      <button
        type="button"
        class="flex items-center gap-3 w-full min-w-0 px-2 py-2 rounded-md hover:bg-accent transition-colors"
        title={auth.user?.display_name || auth.user?.username}
      >
        <div class="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium shrink-0">
          {auth.user?.display_name?.[0] ?? auth.user?.username?.[0] ?? '?'}
        </div>
        <div class="flex-1 min-w-0 text-left">
          <div class="text-sm font-medium text-foreground truncate">
            {auth.user?.display_name || auth.user?.username}
          </div>
          <div class="text-xs text-primary">Online</div>
        </div>
      </button>
    </div>
  );
};
