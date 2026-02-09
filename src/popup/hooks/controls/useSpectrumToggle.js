// src/popup/hooks/controls/useSpectrumToggle.js
// Hook for managing spectrum visualizer toggle state with localStorage persistence.

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "spectrumVisualizerEnabled";

/**
 * Hook for spectrum visualizer toggle with localStorage persistence.
 *
 * @returns {{ spectrumEnabled: boolean, setSpectrumEnabled: Function, toggleSpectrum: Function }}
 */
export function useSpectrumToggle() {
  const [spectrumEnabled, setSpectrumEnabledState] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setSpectrumEnabledState(JSON.parse(stored));
    }
  }, []);

  // Save to localStorage whenever value changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spectrumEnabled));
  }, [spectrumEnabled]);

  // Setter that triggers localStorage save via the effect
  const setSpectrumEnabled = useCallback((value) => {
    setSpectrumEnabledState(value);
  }, []);

  // Toggle helper
  const toggleSpectrum = useCallback(() => {
    setSpectrumEnabledState((prev) => !prev);
  }, []);

  return {
    spectrumEnabled,
    setSpectrumEnabled,
    toggleSpectrum,
  };
}
