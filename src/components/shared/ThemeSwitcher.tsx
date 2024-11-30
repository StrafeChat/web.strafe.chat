import { createSignal, For, onMount, createEffect } from "solid-js";
import { useTheme } from "../../lib/providers/theme/ThemeProvider";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import type { Theme } from "../../lib/themes/types";
import ColorPicker from "./ColorPicker";

const CUSTOM_THEMES_KEY = "sc_custom_themes";
const CUSTOM_CSS_KEY = "sc_custom_css";

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
      // Remove any previously added custom style
      const existingStyle = document.getElementById("custom-app-styles");
      if (existingStyle) {
        existingStyle.remove();
      }

      // Create and apply new custom style
      const styleElement = document.createElement("style");
      styleElement.id = "custom-app-styles";

      // Apply CSS variables
      let cssVariablesString = ":root {\n";
      Object.entries(cssVariables()).forEach(([key, value]) => {
        cssVariablesString += `  ${key}: ${value};\n`;
      });
      cssVariablesString += "}\n\n";

      // Add custom CSS
      styleElement.textContent = cssVariablesString + customCSS();

      document.head.appendChild(styleElement);

      localStorage.setItem(
        CUSTOM_CSS_KEY,
        JSON.stringify({
          css: customCSS(),
          variables: cssVariables(),
        })
      );
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
      (t) => t.id !== themeToDelete.id
    );
    setCustomThemes(updatedCustomThemes);
    saveCustomThemesToLocalStorage(updatedCustomThemes);
  };

  const handleSaveCustomCSS = () => {
    // Validation and saving handled by createEffect
    setIsCustomizingCSS(false);
  };

  return (
    <div class="flex flex-col gap-4 p-4 rounded-lg bg-surface h-[calc(100vh-150px)] overflow-y-auto hide-scrollbar">
      <h2 class="text-lg font-semibold text-text-primary top-0 bg-surface z-10">
        Theme Settings
      </h2>

      {/* Preset Themes */}
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-text-secondary">Preset Themes</h3>
        <div class="grid grid-cols-2 gap-2">
          <For each={availableThemes()}>
            {(availableTheme) => (
              <button
                class={`p-3 rounded-md transition-colors border border-border ${
                  theme().id === availableTheme.id
                    ? "bg-primary text-text-inverse"
                    : "bg-surface hover:bg-primary/10 text-text-primary"
                }`}
                onClick={() => setTheme(availableTheme)}
              >
                <div class="flex items-center gap-2">
                  <div
                    class="w-4 h-4 rounded-full"
                    style={{ background: availableTheme.colors.primary }}
                  />
                  <span>{availableTheme.name}</span>
                </div>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Custom Themes */}
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-medium text-text-secondary">Custom Themes</h3>
          <button
            class="text-sm bg-primary text-text-inverse px-2 py-1 rounded"
            onClick={() => setIsCreatingTheme(!isCreatingTheme())}
          >
            {isCreatingTheme() ? "Cancel" : "Create Theme"}
          </button>
        </div>

        {/* Existing Custom Themes */}
        {customThemes().length > 0 && (
          <div class="grid grid-cols-2 gap-2">
            <For each={customThemes()}>
              {(customTheme) => (
                <div class="flex items-center gap-2 p-2 bg-surface border border-border rounded">
                  <button
                    class={`flex-grow p-2 rounded-md transition-colors ${
                      theme().id === customTheme.id
                        ? "bg-primary text-text-inverse"
                        : "bg-surface hover:bg-primary/10 text-text-primary"
                    }`}
                    onClick={() => setTheme(customTheme)}
                  >
                    <div class="flex items-center gap-2">
                      <div
                        class="w-4 h-4 rounded-full"
                        style={{ background: customTheme.colors.primary }}
                      />
                      <span>{customTheme.name}</span>
                    </div>
                  </button>
                  <button
                    class="text-error hover:bg-error/10 p-1 rounded"
                    onClick={() => handleDeleteTheme(customTheme)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
        )}

        {/* Create Custom Theme */}
        {isCreatingTheme() && (
          <div class="flex flex-col gap-3 p-3 bg-surface border border-border rounded">
            {/* Theme Name Input */}
            <div class="flex flex-col gap-1">
              <label class="text-xs text-text-secondary">Theme Name</label>
              <input
                type="text"
                value={newThemeName()}
                onInput={(e) => setNewThemeName(e.currentTarget.value)}
                class="px-2 py-1 border border-border rounded bg-background text-text-primary"
                placeholder="Enter theme name"
              />
            </div>

            {/* Color Inputs */}
            <div class="grid grid-cols-2 gap-2">
              {/* Top-level colors */}
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Primary</label>
                <div class="flex items-center gap-4">
                  <ColorPicker
                    value={newThemeColors().primary}
                    onChange={(color) =>
                      setNewThemeColors((prev) => ({
                        ...prev,
                        primary: color,
                      }))
                    }
                  />
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().primary}
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Background</label>
                <div class="flex items-center gap-4">
                  <ColorPicker
                    value={newThemeColors().background}
                    onChange={(color) =>
                      setNewThemeColors((prev) => ({
                        ...prev,
                        background: color,
                      }))
                    }
                  />
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().background}
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Accent</label>
                <div class="flex items-center gap-4">
                  <ColorPicker
                    value={newThemeColors().accent}
                    onChange={(color) =>
                      setNewThemeColors((prev) => ({
                        ...prev,
                        accent: color,
                      }))
                    }
                  />
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().accent}
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Surface</label>
                <div class="flex items-center gap-4">
                  <ColorPicker
                    value={newThemeColors().surface}
                    onChange={(color) =>
                      setNewThemeColors((prev) => ({
                        ...prev,
                        surface: color,
                      }))
                    }
                  />
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().surface}
                  </span>
                </div>
              </div>

              {/* Text colors */}
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Text Primary</label>
                <div class="flex items-center gap-4">
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
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().text.primary}
                  </span>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">
                  Text Secondary
                </label>
                <div class="flex items-center gap-4">
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
                  <span class="text-sm text-text-secondary uppercase">
                    {newThemeColors().text.secondary}
                  </span>
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              class="mt-2 bg-primary text-text-inverse px-3 py-2 rounded"
              onClick={handleCreateTheme}
            >
              Create Custom Theme
            </button>
          </div>
        )}
      </div>

      {/* CSS Customization Section */}
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-medium text-text-secondary">App Styling</h3>
          <button
            class="text-sm bg-primary text-text-inverse px-2 py-1 rounded"
            onClick={() => setIsCustomizingCSS(!isCustomizingCSS())}
          >
            {isCustomizingCSS() ? "Cancel" : "Customize CSS"}
          </button>
        </div>

        {isCustomizingCSS() && (
          <div class="flex flex-col gap-3 p-3 bg-surface border border-border rounded">
            {/* CSS Variables Inputs */}
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Font Family</label>
                <input
                  type="text"
                  value={cssVariables()["--font-family"] || ""}
                  onInput={(e) =>
                    setCSSVariables((prev) => ({
                      ...prev,
                      "--font-family": e.currentTarget.value,
                    }))
                  }
                  class="px-2 py-1 border border-border rounded bg-background text-text-primary"
                  placeholder="e.g. Inter, system-ui, sans-serif"
                />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-text-secondary">Border Radius</label>
                <input
                  type="text"
                  value={cssVariables()["--border-radius"] || ""}
                  onInput={(e) =>
                    setCSSVariables((prev) => ({
                      ...prev,
                      "--border-radius": e.currentTarget.value,
                    }))
                  }
                  class="px-2 py-1 border border-border rounded bg-background text-text-primary"
                  placeholder="e.g. 0.375rem"
                />
              </div>
            </div>

            {/* Custom CSS Textarea */}
            <div class="flex flex-col gap-1">
              <label class="text-xs text-text-secondary">Custom CSS</label>
              <textarea
                value={customCSS()}
                onInput={(e) => setCustomCSS(e.currentTarget.value)}
                class="px-2 py-1 min-h-[100px] border border-border rounded bg-background text-text-primary font-mono overflow-y-scroll hide-scrollbar"
                placeholder="Enter custom CSS here. Will be applied globally to the app."
              />
              <p class="text-xs text-text-secondary">
                Tip: Use CSS variables like `var(--font-family)` for consistent
                styling.
              </p>
            </div>

            {/* Save Button */}
            <button
              class="mt-2 bg-primary text-text-inverse px-3 py-2 rounded"
              onClick={handleSaveCustomCSS}
            >
              Save Custom Styles
            </button>
          </div>
        )}

        {/* Current CSS Preview */}
        <div class="p-3 rounded-md bg-surface border border-border overflow-y-scroll hide-scrollbar">
          <h4 class="text-xs font-medium text-text-secondary mb-2">
            Current CSS Variables
          </h4>
          <div class="grid grid-cols-2 gap-1 overflow-y-scroll hide-scrollbar">
            {Object.entries(cssVariables()).map(([key, value]) => (
              <div class="text-xs">
                <span class="text-text-secondary">{key}:</span>
                <span class="text-text-primary">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Theme Info */}
      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-text-secondary">Current Theme</h3>
        <div class="p-3 rounded-md bg-surface border border-border overflow-y-scroll hide-scrollbar">
          <div class="flex flex-col gap-1">
            <p class="text-text-primary">
              <span class="font-medium">Name:</span> {theme().name}
            </p>
            <p class="text-text-primary">
              <span class="font-medium">Author:</span> {theme().author}
            </p>
            {/* Color Preview */}
            <div class="mt-2 grid grid-cols-3 gap-2">
              <div
                class="h-8 rounded"
                style={{ background: theme().colors.primary }}
                title="Primary"
              />
              <div
                class="h-8 rounded"
                style={{ background: theme().colors.accent }}
                title="Accent"
              />
              <div
                class="h-8 rounded"
                style={{ background: theme().colors.surface }}
                title="Surface"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
