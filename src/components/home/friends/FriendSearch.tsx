import { Component, createSignal, createEffect } from "solid-js";

type FriendSearchProps = {
  onSearch: (query: string) => void;
};

export const FriendSearch: Component<FriendSearchProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal("");

  createEffect(() => {
    props.onSearch(searchQuery());
  });

  return (
    <div class="relative mb-4">
      <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="text"
        placeholder="Search friends..."
        value={searchQuery()}
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
        class="w-full rounded-md pl-10 pr-4 py-2 bg-background1 text-sm text-text-primary placeholder:text-text-secondary border border-border hover:bg-background2 focus:bg-background2 focus:border-primary outline-none transition-colors"
      />
    </div>
  );
};
