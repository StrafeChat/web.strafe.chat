import {
  Component,
  createSignal,
  For,
  Show,
  onCleanup,
  onMount,
  createEffect,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
  twemojiCategories,
  getTwemojiUrl,
  type TwemojiEmoji,
} from "../../lib/data/twemojiData";
import { Emoji } from "./Emoji";

interface UnifiedEmojiPickerProps {
  isOpen: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef?: HTMLElement;
  mode?: "chat" | "reaction"; // Different modes for different use cases
  position?: { top: number; left: number }; // Optional manual positioning
}

// Maximum number of recent emojis to store
const MAX_RECENT_EMOJIS = 16;

// Local storage keys for recent emojis (separate for chat and reactions)
const RECENT_EMOJIS_KEYS = {
  chat: "sc_recent_emojis_chat",
  reaction: "sc_recent_emojis_reaction",
};

// Popular reaction emojis for quick access
const POPULAR_REACTIONS = [
  { name: "thumbsup", code: "1f44d", shortcode: "thumbsup" },
  { name: "thumbsdown", code: "1f44e", shortcode: "thumbsdown" },
  { name: "heart", code: "2764", shortcode: "heart" },
  { name: "laughing", code: "1f606", shortcode: "laughing" },
  { name: "cry", code: "1f622", shortcode: "cry" },
  { name: "angry", code: "1f620", shortcode: "angry" },
  { name: "surprised", code: "1f632", shortcode: "surprised" },
  { name: "thinking", code: "1f914", shortcode: "thinking" },
  { name: "fire", code: "1f525", shortcode: "fire" },
  { name: "star", code: "2b50", shortcode: "star" },
  { name: "clap", code: "1f44f", shortcode: "clap" },
  { name: "pray", code: "1f64f", shortcode: "pray" },
];

export const UnifiedEmojiPicker: Component<UnifiedEmojiPickerProps> = (
  props,
) => {
  const [activeCategory, setActiveCategory] = createSignal(
    props.mode === "reaction" ? -2 : -1,
  ); // Start with popular for reactions, recent for chat
  const [recentEmojis, setRecentEmojis] = createSignal<TwemojiEmoji[]>([]);
  const [position, setPosition] = createSignal({ x: 0, y: 0 });
  const [isPositioned, setIsPositioned] = createSignal(false);
  let pickerRef: HTMLDivElement | undefined;

  const storageKey = () => RECENT_EMOJIS_KEYS[props.mode || "chat"];

  // Calculate position based on trigger element
  const calculatePosition = () => {
    if (props.position) {
      setPosition({ x: props.position.left, y: props.position.top });
      setIsPositioned(true);
      return;
    }

    if (!props.triggerRef) {
      // Fallback to center of screen if no trigger
      setPosition({
        x: (window.innerWidth - (props.mode === "reaction" ? 320 : 360)) / 2,
        y: (window.innerHeight - (props.mode === "reaction" ? 300 : 450)) / 2,
      });
      setIsPositioned(true);
      return;
    }

    const rect = props.triggerRef.getBoundingClientRect();
    const pickerWidth = props.mode === "reaction" ? 320 : 360;
    const pickerHeight = props.mode === "reaction" ? 300 : 450;

    let x = rect.left;
    let y = rect.top - pickerHeight - 8;

    // Adjust if picker would go off screen horizontally
    if (x + pickerWidth > window.innerWidth) {
      x = window.innerWidth - pickerWidth - 8;
    }
    if (x < 8) {
      x = 8;
    }

    // Adjust if picker would go off screen vertically
    if (y < 8) {
      y = rect.bottom + 8;
      // If still off screen, position above viewport
      if (y + pickerHeight > window.innerHeight) {
        y = window.innerHeight - pickerHeight - 8;
      }
    }

    setPosition({ x, y });
    setIsPositioned(true);
  };

  // Load recent emojis from localStorage on mount
  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);

    try {
      const storedEmojis = localStorage.getItem(storageKey());
      if (storedEmojis) {
        setRecentEmojis(JSON.parse(storedEmojis));
      }
    } catch (error) {
      console.error("Failed to load recent emojis:", error);
    }

    // Calculate position when opened
    if (props.isOpen) {
      calculatePosition();
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
    const filtered = current.filter((e) => e.shortcode !== emoji.shortcode);
    // Add the emoji to the beginning of the array
    const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
    setRecentEmojis(updated);

    // Save to localStorage
    try {
      localStorage.setItem(storageKey(), JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent emojis:", error);
    }
  };

  const handleEmojiSelect = (emoji: TwemojiEmoji) => {
    addToRecentEmojis(emoji);

    if (props.mode === "chat") {
      // For chat, return the shortcode with colons
      props.onSelect(`:${emoji.shortcode}:`);
    } else {
      // For reactions, return just the shortcode
      props.onSelect(emoji.shortcode);
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  // Recalculate position when opened or trigger changes
  createEffect(() => {
    if (props.isOpen) {
      setIsPositioned(false);
      // Use requestAnimationFrame to ensure DOM is updated and avoid flash
      requestAnimationFrame(() => {
        calculatePosition();
      });
    } else {
      setIsPositioned(false);
    }
  });

  const pickerWidth = props.mode === "reaction" ? "320px" : "360px";
  const pickerHeight = props.mode === "reaction" ? "300px" : "450px";

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div class="fixed inset-0 z-50" onClick={handleBackdropClick}>
          <div
            ref={pickerRef}
            class="absolute bg-background1 border border-border rounded-lg shadow-lg overflow-hidden"
            classList={{
              "invisible opacity-0 pointer-events-none": !isPositioned(),
              "visible opacity-100": isPositioned(),
            }}
            style={{
              left: `${position().x}px`,
              top: `${position().y}px`,
              width: pickerWidth,
              height: pickerHeight,
            }}
          >
            <div class="flex h-full">
              {/* Sidebar */}
              <div class="w-16 border-r border-border overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-400/20 scrollbar-track-transparent">
                {/* Popular reactions (only for reaction mode) */}
                <Show when={props.mode === "reaction"}>
                  <button
                    class="w-full p-3 text-text-secondary hover:bg-surface transition-colors flex flex-col items-center"
                    classList={{
                      "text-primary bg-surface": activeCategory() === -2,
                    }}
                    onClick={() => setActiveCategory(-2)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mb-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span class="text-xs">Popular</span>
                  </button>
                </Show>

                {/* Recent section */}
                <button
                  class="w-full p-3 text-text-secondary hover:bg-surface transition-colors flex flex-col items-center"
                  classList={{
                    "text-primary bg-surface": activeCategory() === -1,
                  }}
                  onClick={() => setActiveCategory(-1)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mb-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <span class="text-xs">Recent</span>
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
              <div
                class="flex-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-400/20 scrollbar-track-transparent"
                style={{ "max-height": pickerHeight }}
              >
                {/* Popular reactions */}
                <Show
                  when={activeCategory() === -2 && props.mode === "reaction"}
                >
                  <div>
                    <h3 class="text-sm font-medium text-text-primary mb-2">
                      Popular Reactions
                    </h3>
                    <div class="grid grid-cols-6 gap-1">
                      <For each={POPULAR_REACTIONS}>
                        {(emoji) => (
                          <button
                            class="w-9 h-9 flex items-center justify-center hover:bg-surface rounded-md transition-colors"
                            onClick={() =>
                              handleEmojiSelect({
                                ...emoji,
                                category: "Popular",
                              })
                            }
                            title={`:${emoji.shortcode}:`}
                          >
                            <Emoji shortcode={emoji.shortcode} size="small" />
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                {/* Recent emojis */}
                <Show when={activeCategory() === -1}>
                  <div>
                    <h3 class="text-sm font-medium text-text-primary mb-2">
                      Recent Emojis
                    </h3>
                    <Show
                      when={recentEmojis().length > 0}
                      fallback={
                        <div class="text-text-secondary text-sm p-4 text-center">
                          No recent emojis yet. Your recently used emojis will
                          appear here.
                        </div>
                      }
                    >
                      <div class="grid grid-cols-7 gap-1">
                        <For each={recentEmojis()}>
                          {(emoji) => (
                            <button
                              class="w-9 h-9 flex items-center justify-center hover:bg-surface rounded-md transition-colors"
                              onClick={() => handleEmojiSelect(emoji)}
                              title={`:${emoji.shortcode}:`}
                            >
                              <Emoji shortcode={emoji.shortcode} size="small" />
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* Category emojis */}
                <Show
                  when={
                    activeCategory() >= 0 && twemojiCategories[activeCategory()]
                  }
                >
                  {(category) => (
                    <div>
                      <h3 class="text-sm font-medium text-text-primary mb-2">
                        {category().name}
                      </h3>
                      <div class="grid grid-cols-7 gap-1">
                        <For each={category().emojis}>
                          {(emoji) => (
                            <button
                              class="w-9 h-9 flex items-center justify-center hover:bg-surface rounded-md transition-colors"
                              onClick={() =>
                                handleEmojiSelect({
                                  ...emoji,
                                  category: category().name,
                                })
                              }
                              title={`:${emoji.shortcode}:`}
                            >
                              <Emoji shortcode={emoji.shortcode} size="small" />
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
        </div>
      </Portal>
    </Show>
  );
};
