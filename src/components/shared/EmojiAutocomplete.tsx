import { Component, createSignal, For, Show, onCleanup, createEffect } from "solid-js";
import { Portal } from "solid-js/web";
import { twemojiCategories, getTwemojiUrl, type TwemojiEmoji, emojiMap } from "../../lib/data/twemojiData";

interface EmojiAutocompleteProps {
  query: string;
  position: { top: number; left: number; width?: number };
  onSelect: (shortcode: string) => void;
  onClose: () => void;
}

export const EmojiAutocomplete: Component<EmojiAutocompleteProps> = (props) => {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [filteredEmojis, setFilteredEmojis] = createSignal<TwemojiEmoji[]>([]);
  let autocompleteRef: HTMLDivElement | undefined;

  // Filter emojis based on query
  createEffect(() => {
    const query = props.query.toLowerCase();
    if (query.length === 0) {
      setFilteredEmojis([]);
      return;
    }

    // Get all emojis from the emoji map
    const allEmojis = Object.values(emojiMap);
    
    // Filter emojis that match the query
    const matches = allEmojis.filter(emoji => 
      emoji.shortcode.toLowerCase().includes(query) ||
      emoji.name.toLowerCase().includes(query)
    ).slice(0, 8); // Limit to 8 results for better UX

    setFilteredEmojis(matches);
    setSelectedIndex(0); // Reset selection when results change
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (filteredEmojis().length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredEmojis().length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev === 0 ? filteredEmojis().length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        const selectedEmoji = filteredEmojis()[selectedIndex()];
        if (selectedEmoji) {
          props.onSelect(selectedEmoji.shortcode);
        }
        break;
      case 'Escape':
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  // Handle click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (autocompleteRef && !autocompleteRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  // Add event listeners
  createEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
  });

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('mousedown', handleClickOutside);
  });

  return (
    <Show when={filteredEmojis().length > 0}>
      <Portal>
        <div
          ref={autocompleteRef}
          class="fixed z-50 bg-background1 border border-border rounded-lg shadow-lg flex flex-col"
          style={{
            top: 'auto',
            bottom: `calc(100vh - ${props.position.top}px)`,
            left: `${props.position.left}px`,
            width: props.position.width ? `${props.position.width}px` : '256px',
          }}
        >
          <div class="p-2">
            <div class="text-xs text-text-secondary mb-2 px-2">
              Emoji suggestions
            </div>
            <div class="max-h-48 overflow-y-auto">
              <For each={filteredEmojis()}>
                {(emoji, index) => (
                  <button
                    class={`w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-surface transition-colors text-left ${
                      index() === selectedIndex() ? 'bg-surface' : ''
                    }`}
                    onClick={() => props.onSelect(emoji.shortcode)}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <img
                      src={getTwemojiUrl(emoji.code)}
                      alt={emoji.name}
                      class="w-5 h-5 flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-text-primary truncate">
                        :{emoji.shortcode}:
                      </div>
                      <div class="text-xs text-text-secondary truncate">
                        {emoji.name}
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </div>
            <Show when={filteredEmojis().length === 8}>
              <div class="text-xs text-text-secondary mt-2 px-2">
                Type more to narrow results
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
};