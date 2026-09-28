import type { Component } from 'solid-js';

/**
 * Fixed full-viewport backdrop behind every page (auth, invite, and the main shell, whose
 * chrome is translucent glass). Deliberately plain: the solid theme background with a
 * single soft brand glow at the top so glass panels have something to blur, and nothing
 * else - no decorations or animation competing with the content in front of it.
 */
export const AppBackground: Component = () => (
  <div class="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
    <div class="absolute inset-0 bg-background" />
    <div
      class="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 80% 45% at 50% -5%, color-mix(in srgb, var(--color-primary), transparent 86%) 0%, transparent 65%)',
      }}
    />
  </div>
);
