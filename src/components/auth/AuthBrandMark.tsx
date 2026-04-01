import type { Component } from 'solid-js';
import { A } from '@solidjs/router';

/** Fixed top-start wordmark — text only, no panel. */
export const AuthBrandMark: Component = () => {
  return (
    <A
      href="/"
      class="pointer-events-auto fixed start-4 top-4 z-[100] font-brand text-xl font-extrabold leading-none tracking-tight transition-colors sm:text-2xl underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="Strafe — home"
    >
      <span class="text-primary">Strafe</span>
      <span class="text-foreground">.chat</span>
    </A>
  );
};
