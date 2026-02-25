import type { Component } from 'solid-js';

const NotesIcon = () => (
  <svg class="size-24 text-muted-foreground/40 mx-auto mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const NotesPage: Component = () => (
  <div class="flex-1 flex flex-col">
    <div class="h-12 flex items-center px-4 border-b border-border shrink-0">
      <h1 class="text-base font-semibold text-foreground">Notes</h1>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <NotesIcon />
      <h2 class="text-2xl font-semibold text-foreground mb-2">Personal notes</h2>
      <p class="text-muted-foreground max-w-md">
        Keep notes for yourself. Create your first note to get started.
      </p>
    </div>
  </div>
);

export default NotesPage;
