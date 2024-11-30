import { 
  createContext, 
  createSignal, 
  useContext, 
  createEffect, 
  type ParentComponent 
} from 'solid-js';
import { darkTheme, lightTheme } from '../../themes/default';
import type { Theme, ThemeContextType } from '../../themes/types';

const THEME_STORAGE_KEY = 'sc_theme';

const ThemeContext = createContext<ThemeContextType>();

export const ThemeProvider: ParentComponent = (props) => {
  const getSavedTheme = (): Theme => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return savedTheme ? JSON.parse(savedTheme) : darkTheme;
    } catch {
      return darkTheme;
    }
  };

  const [theme, setTheme] = createSignal<Theme>(getSavedTheme());
  const [availableThemes, setAvailableThemes] = createSignal<Theme[]>([
    lightTheme, 
    darkTheme
  ]);

  createEffect(() => {
    const currentTheme = theme();
    
    const root = document.documentElement;
    const themeColors = currentTheme.colors;

    Object.entries({
      '--primary': themeColors.primary,
      '--background': themeColors.background,
      '--background0': themeColors.background0,
      '--background1': themeColors.background1,
      '--background2': themeColors.background2,
      '--foreground': themeColors.foreground,
      '--accent': themeColors.accent,
      '--surface': themeColors.surface,
      '--text-primary': themeColors.text.primary,
      '--text-secondary': themeColors.text.secondary,
      '--text-accent': themeColors.text.accent,
      '--text-inverse': themeColors.text.inverse,
      '--border': themeColors.border,
      '--error': themeColors.error,
      '--success': themeColors.success,
      '--warning': themeColors.warning,
      
      '--shadow-sm': currentTheme.shadows.sm,
      '--shadow-md': currentTheme.shadows.md,
      '--shadow-lg': currentTheme.shadows.lg,
      
      '--radius-sm': currentTheme.radii.sm,
      '--radius-md': currentTheme.radii.md,
      '--radius-lg': currentTheme.radii.lg,
      '--radius-full': currentTheme.radii.full
    }).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(currentTheme));
    } catch {
      console.warn('Could not save theme to localStorage.');
    }
  });

  const addTheme = (newTheme: Theme) => {
    setAvailableThemes(current => {
      if (!current.some(t => t.id === newTheme.id)) {
        return [...current, newTheme];
      }
      return current;
    });
  };

  const removeTheme = (themeId: string) => {
    setAvailableThemes(current => 
      current.filter(t => t.id !== themeId)
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        availableThemes,
        addTheme,
        removeTheme,
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
