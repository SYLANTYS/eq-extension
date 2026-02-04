import { useState, useEffect } from "react";
import { sendMessage, MSG } from "../../lib/chromeMessaging.js";

/**
 * Hook for fetching and managing spectrum analyzer data.
 * Continuously fetches spectrum data when EQ is active using requestAnimationFrame.
 * @param {boolean} eqActive - Whether EQ is currently active
 * @param {number|null} currentTabId - The current tab ID
 * @returns {number[]} spectrumData - Array of frequency bin values
 */
export function useSpectrumData(eqActive, currentTabId) {
  const [spectrumData, setSpectrumData] = useState([]);

  // Fetch spectrum data continuously when EQ is active
  useEffect(() => {
    if (!eqActive || !currentTabId) return;

    let animationFrameId;

    async function fetchSpectrum() {
      try {
        const res = await sendMessage({
          type: MSG.GET_SPECTRUM_DATA,
          tabId: currentTabId,
        });

        if (res?.ok && res?.spectrumData) {
          setSpectrumData(res.spectrumData);
        }
      } catch (e) {
        console.warn("[Popup] Failed to fetch spectrum data:", e);
      }

      // Schedule next fetch for next animation frame
      animationFrameId = requestAnimationFrame(fetchSpectrum);
    }

    // Start fetching spectrum data
    fetchSpectrum();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [eqActive, currentTabId]);

  return spectrumData;
}
