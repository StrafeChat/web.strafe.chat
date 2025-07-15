import { createSignal, For, onMount, createEffect, Show } from "solid-js";
import { useTheme } from "../../lib/providers/theme/ThemeProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import type { Theme } from "../../lib/themes/types";
import ColorPicker from "./ColorPicker";
import {
  CUSTOM_CSS_KEY,
  applyCustomStyles,
} from "../../lib/utils/customStyles";
import Palette from "./icons/Palette";
import Settings from "./icons/Settings";
import Plus from "./icons/Plus";
import Trash from "./icons/Trash";

const CUSTOM_THEMES_KEY = "sc_custom_themes";

export function ThemeSwitcher() {
  const { theme, setTheme, availableThemes, addTheme } = useTheme();
  const { user } = useAuth();

  // Custom theme creation state
  const [isCreatingTheme, setIsCreatingTheme] = createSignal(false);
  const [newThemeName, setNewThemeName] = createSignal("");
  const [customThemes, setCustomThemes] = createSignal<Theme[]>([]);
  const [newThemeColors, setNewThemeColors] = createSignal({
    primary: "#21c35e",
    background: "#ffffff",
    foreground: "#000000",
    accent: "#1a9d4b",
    surface: "#f5f5f5",
    text: {
      primary: "#000000",
      secondary: "#666666",
      accent: "#21c35e",
      inverse: "#ffffff",
    },
    border: "#e0e0e0",
    error: "#ff3b30",
    success: "#34c759",
    warning: "#ffcc00",
  });

  // CSS customization state
  const [isCustomizingCSS, setIsCustomizingCSS] = createSignal(false);
  const [customCSS, setCustomCSS] = createSignal("");
  const [cssVariables, setCSSVariables] = createSignal({
    "--font-family": "Inter, system-ui, sans-serif",
    "--border-radius": "0.375rem",
    "--box-shadow": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "--transition-speed": "0.2s",
    "--input-padding": "0.5rem",
    "--button-padding": "0.625rem 1rem",
  });

  // Load custom themes from localStorage on mount
  onMount(() => {
    try {
      const storedThemes = localStorage.getItem(CUSTOM_THEMES_KEY);
      if (storedThemes) {
        const parsedThemes = JSON.parse(storedThemes);
        setCustomThemes(parsedThemes);
        parsedThemes.forEach(addTheme);
      }

      const storedCSS = localStorage.getItem(CUSTOM_CSS_KEY);
      if (storedCSS) {
        const parsedCSS = JSON.parse(storedCSS);
        setCustomCSS(parsedCSS.css || "");
        setCSSVariables(parsedCSS.variables || {});
      }
    } catch (error) {
      console.error("Error loading custom themes or CSS:", error);
    }
  });

  const saveCustomThemesToLocalStorage = (themes: Theme[]) => {
    try {
      localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
    } catch (error) {
      console.error("Error saving custom themes:", error);
    }
  };

  // Apply custom CSS effect
  createEffect(() => {
    try {
      // Store the updated custom CSS data
      localStorage.setItem(
        CUSTOM_CSS_KEY,
        JSON.stringify({
          css: customCSS(),
          variables: cssVariables(),
        }),
      );

      // Apply the updated styles
      applyCustomStyles();
    } catch (error) {
      console.error("Error applying custom styles:", error);
    }
  });

  const handleCreateTheme = () => {
    if (!newThemeName()) {
      alert("Please enter a theme name");
      return;
    }

    const customTheme: Theme = {
      id: `custom-${Date.now()}`,
      name: newThemeName(),
      author: user()!.username,
      colors: {
        ...newThemeColors(),
        background0: newThemeColors().background /*_ Space list background _*/,
        background1:
          newThemeColors().surface /*_ Room/members list background _*/,
        background2:
          newThemeColors().background /*_ Main chat area background _*/,
      },
      shadows: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      },
      radii: {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        full: "9999px",
      },
    };

    const updatedCustomThemes = [...customThemes(), customTheme];
    setCustomThemes(updatedCustomThemes);
    saveCustomThemesToLocalStorage(updatedCustomThemes);

    addTheme(customTheme);
    setTheme(customTheme);
    setIsCreatingTheme(false);
    setNewThemeName("");
  };

  const handleDeleteTheme = (themeToDelete: Theme) => {
    const updatedCustomThemes = customThemes().filter(
      (t) => t.id !== themeToDelete.id,
    );
    setCustomThemes(updatedCustomThemes);
    saveCustomThemesToLocalStorage(updatedCustomThemes);
  };

  const handleSaveCustomCSS = () => {
    // Validation and saving handled by createEffect
    setIsCustomizingCSS(false);
  };

  return (
    <div class="flex flex-col gap-6">
      {/* Preset Themes Section */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 bg-primary/10 rounded-lg">
            <Palette />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Preset Themes</h3>
            <p class="text-text-secondary text-sm">Choose from our curated theme collection</p>
          </div>
        </div>
        <div class="bg-background2 rounded-lg p-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <For each={availableThemes()}>
              {(availableTheme) => (
                <button
                  class={`group relative p-4 rounded-lg transition-all duration-200 border-2 ${
                    theme().id === availableTheme.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  onClick={() => setTheme(availableTheme)}
                >
                  <div class="flex items-center gap-3">
                    <div class="flex gap-1">
                      <div
                        class="w-4 h-4 rounded-full border border-white/20"
                        style={{ background: availableTheme.colors.primary }}
                      />
                      <div
                        class="w-4 h-4 rounded-full border border-white/20"
                        style={{ background: availableTheme.colors.accent }}
                      />
                      <div
                        class="w-4 h-4 rounded-full border border-white/20"
                        style={{ background: availableTheme.colors.surface }}
                      />
                    </div>
                    <div class="flex-1 text-left">
                      <span class="text-text-primary font-medium">{availableTheme.name}</span>
                      <p class="text-text-secondary text-xs">by {availableTheme.author}</p>
                    </div>
                    {theme().id === availableTheme.id && (
                      <div class="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Custom Themes Section */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-500/10 rounded-lg">
              <Settings />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-text-primary">Custom Themes</h3>
              <p class="text-text-secondary text-sm">Create and manage your personalized themes</p>
            </div>
          </div>
          <button
            class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isCreatingTheme()
                ? "bg-error/10 text-error hover:bg-error/20"
                : "bg-primary text-white hover:bg-primary/90 shadow-sm"
            }`}
            onClick={() => setIsCreatingTheme(!isCreatingTheme())}
          >
            {isCreatingTheme() ? (
              <>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <Plus />
                Create Theme
              </>
            )}
          </button>
        </div>

        <div class="bg-background2 rounded-lg p-4">
          {/* Existing Custom Themes */}
          <Show when={customThemes().length > 0} fallback={
            <div class="text-center py-8">
              <div class="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Palette />
              </div>
              <p class="text-text-secondary text-sm">No custom themes yet</p>
              <p class="text-text-secondary text-xs mt-1">Create your first custom theme to get started</p>
            </div>
          }>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <For each={customThemes()}>
                {(customTheme) => (
                  <div class={`group relative p-4 rounded-lg border-2 transition-all duration-200 ${
                    theme().id === customTheme.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-primary/5"
                  }`}>
                    <button
                      class="w-full text-left"
                      onClick={() => setTheme(customTheme)}
                    >
                      <div class="flex items-center gap-3">
                        <div class="flex gap-1">
                          <div
                            class="w-4 h-4 rounded-full border border-white/20"
                            style={{ background: customTheme.colors.primary }}
                          />
                          <div
                            class="w-4 h-4 rounded-full border border-white/20"
                            style={{ background: customTheme.colors.accent }}
                          />
                          <div
                            class="w-4 h-4 rounded-full border border-white/20"
                            style={{ background: customTheme.colors.surface }}
                          />
                        </div>
                        <div class="flex-1">
                          <span class="text-text-primary font-medium">{customTheme.name}</span>
                          <p class="text-text-secondary text-xs">by {customTheme.author}</p>
                        </div>
                        {theme().id === customTheme.id && (
                          <div class="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                    <button
                      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-error/10 text-error hover:bg-error/20"
                      onClick={() => handleDeleteTheme(customTheme)}
                      title="Delete theme"
                    >
                      <Trash />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Create Custom Theme Form */}
          <Show when={isCreatingTheme()}>
            <div class="border-t border-border pt-4">
              <div class="bg-background1 rounded-lg p-4 space-y-4">
                {/* Theme Name Input */}
                <div class="space-y-2">
                  <label class="text-sm font-medium text-text-primary">Theme Name</label>
                  <input
                    type="text"
                    value={newThemeName()}
                    onInput={(e) => setNewThemeName(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-border rounded-lg bg-background2 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    placeholder="Enter a unique theme name"
                  />
                </div>

                {/* Color Configuration */}
                <div class="space-y-3">
                  <h4 class="text-sm font-medium text-text-primary">Color Configuration</h4>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Primary Colors */}
                    <div class="space-y-3">
                      <h5 class="text-xs font-medium text-text-secondary uppercase tracking-wide">Primary Colors</h5>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Primary</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().primary}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  primary: color,
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().primary}
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Accent</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().accent}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  accent: color,
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().accent}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Background Colors */}
                    <div class="space-y-3">
                      <h5 class="text-xs font-medium text-text-secondary uppercase tracking-wide">Background Colors</h5>
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Background</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().background}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  background: color,
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().background}
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Surface</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().surface}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  surface: color,
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().surface}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Text Colors */}
                    <div class="space-y-3 sm:col-span-2">
                      <h5 class="text-xs font-medium text-text-secondary uppercase tracking-wide">Text Colors</h5>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Primary Text</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().text.primary}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  text: {
                                    ...prev.text,
                                    primary: color,
                                  },
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().text.primary}
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center justify-between">
                          <label class="text-sm text-text-primary">Secondary Text</label>
                          <div class="flex items-center gap-3">
                            <ColorPicker
                              value={newThemeColors().text.secondary}
                              onChange={(color) =>
                                setNewThemeColors((prev) => ({
                                  ...prev,
                                  text: {
                                    ...prev.text,
                                    secondary: color,
                                  },
                                }))
                              }
                            />
                            <span class="text-xs text-text-secondary font-mono">
                              {newThemeColors().text.secondary}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <div class="flex justify-end pt-2">
                  <button
                    class="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleCreateTheme}
                    disabled={!newThemeName().trim()}
                  >
                    <Plus />
                    Create Theme
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Advanced Styling Section */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-purple-500/10 rounded-lg">
              <Settings />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-text-primary">Advanced Styling</h3>
              <p class="text-text-secondary text-sm">Customize CSS variables and add custom styles</p>
            </div>
          </div>
          <button
            class={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isCustomizingCSS()
                ? "bg-error/10 text-error hover:bg-error/20"
                : "bg-primary text-white hover:bg-primary/90 shadow-sm"
            }`}
            onClick={() => setIsCustomizingCSS(!isCustomizingCSS())}
          >
            {isCustomizingCSS() ? (
              <>
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <Settings />
                Customize CSS
              </>
            )}
          </button>
        </div>

        <div class="bg-background2 rounded-lg p-4">
          <Show when={isCustomizingCSS()} fallback={
            <div class="space-y-3">
              <h4 class="text-sm font-medium text-text-primary">Current CSS Variables</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(cssVariables()).map(([key, value]) => (
                  <div class="flex justify-between items-center p-2 bg-background1 rounded border border-border">
                    <span class="text-xs text-text-secondary font-mono">{key}</span>
                    <span class="text-xs text-text-primary font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          }>
            <div class="space-y-6">
              {/* CSS Variables */}
              <div class="space-y-3">
                <h4 class="text-sm font-medium text-text-primary">CSS Variables</h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <label class="text-sm text-text-primary">Font Family</label>
                    <input
                      type="text"
                      value={cssVariables()["--font-family"] || ""}
                      onInput={(e) =>
                        setCSSVariables((prev) => ({
                          ...prev,
                          "--font-family": e.currentTarget.value,
                        }))
                      }
                      class="w-full px-3 py-2 border border-border rounded-lg bg-background1 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm"
                      placeholder="Inter, system-ui, sans-serif"
                    />
                  </div>
                  <div class="space-y-2">
                    <label class="text-sm text-text-primary">Border Radius</label>
                    <input
                      type="text"
                      value={cssVariables()["--border-radius"] || ""}
                      onInput={(e) =>
                        setCSSVariables((prev) => ({
                          ...prev,
                          "--border-radius": e.currentTarget.value,
                        }))
                      }
                      class="w-full px-3 py-2 border border-border rounded-lg bg-background1 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm"
                      placeholder="0.375rem"
                    />
                  </div>
                </div>
              </div>

              {/* Custom CSS */}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium text-text-primary">Custom CSS</label>
                  <span class="text-xs text-text-secondary">Applied globally to the app</span>
                </div>
                <textarea
                  value={customCSS()}
                  onInput={(e) => setCustomCSS(e.currentTarget.value)}
                  class="w-full px-3 py-2 min-h-[120px] border border-border rounded-lg bg-background1 text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm resize-none"
                  placeholder="/* Enter custom CSS here */\n.my-custom-class {\n  /* Your styles */\n}"
                />
                <p class="text-xs text-text-secondary">
                  💡 Tip: Use CSS variables like <code class="bg-background1 px-1 rounded">var(--font-family)</code> for consistent styling
                </p>
              </div>

              {/* Save Button */}
              <div class="flex justify-end pt-2">
                <button
                  class="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  onClick={handleSaveCustomCSS}
                >
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6a1 1 0 10-2 0v5.586l-1.293-1.293z" />
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  Save Custom Styles
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* Current Theme Info */}
      <div class="bg-background1 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Active Theme</h3>
            <p class="text-text-secondary text-sm">Currently applied theme information</p>
          </div>
        </div>
        
        <div class="bg-background2 rounded-lg p-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h4 class="text-lg font-semibold text-text-primary">{theme().name}</h4>
              <p class="text-text-secondary text-sm">Created by {theme().author}</p>
            </div>
            <div class="flex gap-2">
              <div
                class="w-8 h-8 rounded-lg border-2 border-white/20 shadow-sm"
                style={{ background: theme().colors.primary }}
                title="Primary Color"
              />
              <div
                class="w-8 h-8 rounded-lg border-2 border-white/20 shadow-sm"
                style={{ background: theme().colors.accent }}
                title="Accent Color"
              />
              <div
                class="w-8 h-8 rounded-lg border-2 border-white/20 shadow-sm"
                style={{ background: theme().colors.surface }}
                title="Surface Color"
              />
            </div>
          </div>
          
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="text-center">
              <div
                class="w-full h-12 rounded-lg border border-border mb-2"
                style={{ background: theme().colors.primary }}
              />
              <p class="text-xs text-text-secondary">Primary</p>
              <p class="text-xs text-text-primary font-mono">{theme().colors.primary}</p>
            </div>
            <div class="text-center">
              <div
                class="w-full h-12 rounded-lg border border-border mb-2"
                style={{ background: theme().colors.accent }}
              />
              <p class="text-xs text-text-secondary">Accent</p>
              <p class="text-xs text-text-primary font-mono">{theme().colors.accent}</p>
            </div>
            <div class="text-center">
              <div
                class="w-full h-12 rounded-lg border border-border mb-2"
                style={{ background: theme().colors.surface }}
              />
              <p class="text-xs text-text-secondary">Surface</p>
              <p class="text-xs text-text-primary font-mono">{theme().colors.surface}</p>
            </div>
            <div class="text-center">
              <div
                class="w-full h-12 rounded-lg border border-border mb-2"
                style={{ background: theme().colors.background }}
              />
              <p class="text-xs text-text-secondary">Background</p>
              <p class="text-xs text-text-primary font-mono">{theme().colors.background}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
