import { Component, createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { twemojiCategories, getTwemojiUrl, type TwemojiEmoji } from "../../lib/data/twemojiData";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

// Maximum number of recent emojis to store
const MAX_RECENT_EMOJIS = 16;

// Local storage key for recent emojis
const RECENT_EMOJIS_KEY = "strafe-recent-emojis";

export const EmojiPicker: Component<EmojiPickerProps> = (props) => {
  const [activeCategory, setActiveCategory] = createSignal(0);
  const [recentEmojis, setRecentEmojis] = createSignal<TwemojiEmoji[]>([]);
  let pickerRef: HTMLDivElement | undefined;

  // Load recent emojis from localStorage on mount
  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    
    try {
      const storedEmojis = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (storedEmojis) {
        setRecentEmojis(JSON.parse(storedEmojis));
      }
    } catch (error) {
      console.error("Failed to load recent emojis:", error);
    }
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  const handleClickOutside = (event: MouseEvent) => {
    if (pickerRef && !pickerRef.contains(event.target as Node)) {
      props.onClose();
    }
  };

  const addToRecentEmojis = (emoji: TwemojiEmoji) => {
    const current = recentEmojis();
    // Remove the emoji if it already exists
    const filtered = current.filter(e => e.shortcode !== emoji.shortcode);
    // Add the emoji to the beginning of the array
    const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
    setRecentEmojis(updated);
    
    // Save to localStorage
    try {
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent emojis:", error);
    }
  };

  const handleEmojiSelect = (emoji: TwemojiEmoji) => {
    addToRecentEmojis(emoji);
    // Return the emoji shortcode
    props.onSelect(`:${emoji.shortcode}:`);
  };

  return (
    <Portal>
      <div
        ref={pickerRef}
        class="fixed z-50 bg-background1 border border-border rounded-lg shadow-lg overflow-hidden"
        style={{
          top: `${props.position.top}px`,
          left: `${props.position.left}px`,
          width: "360px",
          height: "450px",
        }}
      >
        <div class="flex h-full">
          {/* Sidebar */}
          <div class="w-16 border-r border-border overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-400/20 scrollbar-track-transparent">
            {/* Recent section */}
            <button
              class="w-full p-3 text-text-secondary hover:bg-surface transition-colors flex flex-col items-center"
              classList={{
                "text-primary bg-surface": activeCategory() === -1,
              }}
              onClick={() => setActiveCategory(-1)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
              <span class="text-xs">Recent</span>
            </button>
            
            {/* Space placeholder */}
            <button
              class="w-full p-3 text-text-secondary hover:bg-surface transition-colors flex flex-col items-center opacity-50"
              disabled
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clip-rule="evenodd" />
              </svg>
              <span class="text-xs">Spaces</span>
            </button>
            
            {/* Category buttons */}
            <For each={twemojiCategories}>
              {(category, index) => (
                <button
                  class="w-full p-3 text-text-secondary hover:bg-surface transition-colors flex flex-col items-center"
                  classList={{
                    "text-primary bg-surface": activeCategory() === index(),
                  }}
                  onClick={() => setActiveCategory(index())}
                >
                  <img 
                    src={getTwemojiUrl(category.icon)} 
                    alt={category.name} 
                    class="w-5 h-5 mb-1"
                    loading="lazy"
                  />
                  <span class="text-xs">{category.name.split(" ")[0]}</span>
                </button>
              )}
            </For>
          </div>

          {/* Emoji content */}
          <div class="flex-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-400/20 scrollbar-track-transparent" style={{ "max-height": "450px" }}>
            {/* Recent emojis */}
            <Show when={activeCategory() === -1}>
              <div>
                <h3 class="text-sm font-medium text-text-primary mb-2">Recent Emojis</h3>
                <Show when={recentEmojis().length > 0} fallback={
                  <div class="text-text-secondary text-sm p-4 text-center">
                    No recent emojis yet. Your recently used emojis will appear here.
                  </div>
                }>
                  <div class="grid grid-cols-7 gap-1">
                    <For each={recentEmojis()}>
                      {(emoji) => (
                        <button
                          class="w-9 h-9 flex items-center justify-center hover:bg-surface rounded-md transition-colors"
                          onClick={() => handleEmojiSelect(emoji)}
                          title={`:${emoji.shortcode}:`}
                        >
                          <img 
                            src={getTwemojiUrl(emoji.code)} 
                            alt={emoji.name} 
                            class="w-6 h-6"
                            loading="lazy"
                          />
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Category emojis */}
            <Show when={activeCategory() >= 0 && twemojiCategories[activeCategory()]}>
              {(category) => (
                <div>
                  <h3 class="text-sm font-medium text-text-primary mb-2">{category().name}</h3>
                  <div class="grid grid-cols-7 gap-1">
                    <For each={category().emojis}>
                      {(emoji) => (
                        <button
                          class="w-9 h-9 flex items-center justify-center hover:bg-surface rounded-md transition-colors"
                          onClick={() => handleEmojiSelect({ ...emoji, category: category().name })}
                          title={`:${emoji.shortcode}:`}
                        >
                          <img 
                            src={getTwemojiUrl(emoji.code)} 
                            alt={emoji.name} 
                            class="w-6 h-6"
                            loading="lazy"
                          />
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </div>
    </Portal>
  );
};