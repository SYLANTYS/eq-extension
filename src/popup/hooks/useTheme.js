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
  //monochrome or apple
  {
    BACKGROUND: "#F2F2F7",
    TEXT: "#4b4743",
    POINT: "#007AFF",
    SHELF: "#FF3B30",
  },
  //terminal
  {
    BACKGROUND: "#060A08",
    TEXT: "#6FE3B2",
    POINT: "#9AF0C8",
    SHELF: "#5B6EFF",
  },
  //red and white ferrari
  {
    BACKGROUND: "#fcfad4",
    TEXT: "#9b2a2a",
    POINT: "#ed1c23",
    SHELF: "#7a2020",
  },
  //purple gold
  {
    BACKGROUND: "#2a2436",
    TEXT: "#f2d9a6",
    POINT: "#E0115F",
    SHELF: "#7a4f9a",
  },
  //Hungary / Italy
  {
    BACKGROUND: "#7a1414",
    TEXT: "#F2F2F7",
    POINT: "#3fef7f",
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
