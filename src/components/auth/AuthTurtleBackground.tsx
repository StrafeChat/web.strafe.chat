import type { Component } from 'solid-js';
import { For } from 'solid-js';

interface AuthTurtleBackgroundProps {
  show: boolean;
}

export const AuthTurtleBackground: Component<AuthTurtleBackgroundProps> = (props) => {
  const turtles = [
    // Static positions so switching routes doesn't change layout.
    { left: '7%', top: '10%', size: 56, opacity: 0.13, duration: 12, delay: -8 },
    { left: '78%', top: '38%', size: 42, opacity: 0.11, duration: 15, delay: -6 },
    { left: '62%', top: '18%', size: 28, opacity: 0.09, duration: 13, delay: -9 },
    { left: '14%', top: '68%', size: 52, opacity: 0.11, duration: 14, delay: -7 },
    { left: '86%', top: '70%', size: 30, opacity: 0.09, duration: 16, delay: -10 },
  ];

  return (
    <div
      class={`fixed inset-0 z-0 pointer-events-none transition-opacity duration-300 ${props.show ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden="true"
    >
      {/* Match strafe_chat landing (app/page.tsx) background stack */}
      <div class="absolute inset-0 bg-background" />
      <div class="absolute inset-0 bg-linear-to-b from-background via-background to-background" />
      <div
        class="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, var(--color-primary), transparent 80%) 0%, transparent 60%)',
        }}
      />

      <div class="turtle-bg">
        <For each={turtles}>
          {(t) => (
            <span
              class="turtle-emoji turtle-float"
              style={`left:${t.left};top:${t.top};font-size:${t.size}px;opacity:${t.opacity};animation-duration:${t.duration}s;animation-delay:${t.delay}s;`}
            >
              🐢
            </span>
          )}
        </For>
      </div>

      <div class="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-background to-transparent" />
    </div>
  );
};

