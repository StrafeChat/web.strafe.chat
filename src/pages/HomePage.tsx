import type { Component } from 'solid-js';
import { createMemo } from 'solid-js';
import { A } from '@solidjs/router';
import { auth } from '../stores/auth';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

const HomePage: Component = () => {
  const greeting = createMemo(() => getGreeting());
  const name = () => auth.user?.display_name || auth.user?.username || 'there';

  return (
    <div class="flex-1 flex flex-col">
      <div class="h-12 flex items-center gap-2 px-4 border-b border-border shrink-0">
        <i class="fa-solid fa-house text-muted-foreground shrink-0" />
        <h1 class="text-base font-semibold text-foreground">Home</h1>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h1 class="text-3xl font-bold text-foreground mb-2">
          {greeting()}, {name()}!
        </h1>
        <p class="text-muted-foreground mb-8 max-w-md">
          Welcome to StrafeChat. Your messages are end-to-end encrypted.
        </p>
        <div class="flex flex-wrap gap-4 justify-center">
          <A
            href="/friends"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
          >
            Add Friends
          </A>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-accent transition-colors"
          >
            Start a Conversation
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-accent transition-colors"
          >
            Create a Space
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
