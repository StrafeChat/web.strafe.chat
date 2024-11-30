import type { Accessor, Setter } from "solid-js";

export interface Theme {
  id: string;
  name: string;
  author: string;
  colors: {
    primary: string;
    background: string;
    background0: string;
    background1: string;
    background2: string;
    foreground: string;
    accent: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      accent: string;
      inverse: string;
    };
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  radii: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
}

export interface ThemeContextType {
  theme: Accessor<Theme>;
  setTheme: Setter<Theme>;
  availableThemes: Accessor<Theme[]>;
  addTheme: (theme: Theme) => void;
  removeTheme: (themeId: string) => void;
}
