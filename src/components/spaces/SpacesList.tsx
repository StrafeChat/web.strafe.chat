import { Component } from "solid-js";
import { useNavigate } from "@solidjs/router";

const SpacesList: Component = () => {
  const navigate = useNavigate();

  return (
    <div class="flex flex-col items-center h-full py-3 gap-2 bg-[var(--background)]">
      {/* Home Button */}
      <button
        class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all group relative"
        onClick={() => navigate("/")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-6 h-6 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* Separator */}
      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Flex spacer to push buttons to bottom */}
      <div class="flex-1"></div>

      <div class="w-8 h-0.5 rounded-full bg-border" />

      {/* Bottom buttons container */}
      <div class="flex flex-col gap-2">
        <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <button class="w-12 h-12 rounded-full bg-surface hover:bg-accent transition-all">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SpacesList;
