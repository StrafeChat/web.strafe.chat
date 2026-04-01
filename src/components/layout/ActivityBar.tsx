import type { Component } from 'solid-js';
import { appActivityRail, appHeaderBar } from '../../theme/appChrome';

const SleepIcon = () => (
  <svg class="size-12 text-muted-foreground/50 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

export const ActivityBar: Component = () => {
  return (
    <aside class={`hidden w-[240px] shrink-0 flex-col overflow-hidden lg:flex lg:flex-col ${appActivityRail}`}>
      <div class={`p-3 ${appHeaderBar}`}>
        <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Now</h3>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <SleepIcon />
        <p class="text-sm font-medium text-foreground mb-1">It's quiet for now...</p>
        <p class="text-xs text-muted-foreground">
          When friends are active in voice channels, their activity will appear here.
        </p>
      </div>
    </aside>
  );
};
