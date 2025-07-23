import { Component } from "solid-js";

const Notes: Component = () => {
  return (
    <div class="h-full w-full bg-background2 select-none">
      <div class="flex flex-col h-full">
        <div class="p-2 flex flex-col border-b border-surface border-opacity-20">
          <div class="flex items-center gap-4">
            <h2 class="text-xl px-3 py-2 font-semibold text-text-primary select-none flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 2H6C5 2 4 3 4 4v16c0 1 1 2 2 2h12c1 0 2-1 2-2V4c0-1-1-2-2-2z" />
                <path d="M18 2l3 3h-3V2" />
                <path d="M8 8h8" />
                <path d="M8 12h8" />
                <path d="M8 16h8" />
              </svg>
              Notes
            </h2>
          </div>
        </div>

        <div class="flex-1 p-8 flex flex-col items-center justify-center text-text-secondary select-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-12 h-12 mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 2H6C5 2 4 3 4 4v16c0 1 1 2 2 2h12c1 0 2-1 2-2V4c0-1-1-2-2-2z" />
            <path d="M18 2l3 3h-3V2" />
            <path d="M8 8h8" />
            <path d="M8 12h8" />
            <path d="M8 16h8" />
          </svg>
          <h2 class="text-xl font-medium mb-2 select-none">
            Notes Coming Soon
          </h2>
          <p class="text-sm select-none">
            Your personal notes and reminders will appear here
          </p>
        </div>
      </div>
    </div>
  );
};

export default Notes;
