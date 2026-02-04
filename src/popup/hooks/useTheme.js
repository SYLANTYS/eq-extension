import { useState, useEffect } from "react";

// Theme definitions - add new themes as additional objects
export const THEMES = [
  //default
  {
    BACKGROUND: "#2c3e50",
    TEXT: "#f5deb3",
    POINT: "#c6f6dd",
    SHELF: "#8a689e",
  },
  //USA
  {
    BACKGROUND: "#1f2f4a",
    TEXT: "#dddddd",
    POINT: "#ffffff",
    SHELF: "#b02020",
  },
  //monochrome
  {
    BACKGROUND: "#242424",
    TEXT: "#cccccc",
    POINT: "#ffffff",
    SHELF: "#0a0a0a",
  },
  //terminal
  {
    BACKGROUND: "#070b09",
    TEXT: "#7fe3ae",
    POINT: "#bfead3",
    SHELF: "#4b5fe0",
  },
  //red and white
  {
    BACKGROUND: "#f1f0dc",
    TEXT: "#8b1a1a",
    POINT: "#ba3434",
    SHELF: "#4a0000",
  },
  //purple gold
  {
    BACKGROUND: "#2a2436",
    TEXT: "#f2d9a6",
    POINT: "#e6c27a",
    SHELF: "#7a4f9a",
  },
  //Hungary / Italy
  {
    BACKGROUND: "#7a1414",
    TEXT: "#ffffff",
    POINT: "#2fbf5f",
    SHELF: "#ffffff",
  },
];

const STORAGE_KEY = "eqThemeIndex";
const DEFAULT_THEME_INDEX = 1;

/**
 * Hook for managing theme state with localStorage persistence.
 * @returns {{ themeIndex: number, setThemeIndex: function, COLORS: object, THEMES: array }}
 */
export function useTheme() {
  const [themeIndex, setThemeIndexState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_THEME_INDEX;
  });

  // Persist theme changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themeIndex));
  }, [themeIndex]);

  // Get current theme colors
  const COLORS = THEMES[themeIndex];

  return {
    themeIndex,
    setThemeIndex: setThemeIndexState,
    COLORS,
    THEMES,
  };
}
