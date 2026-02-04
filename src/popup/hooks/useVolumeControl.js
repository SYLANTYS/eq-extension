import { useState, useCallback } from "react";
import { sendMessage, MSG } from "../../lib/chromeMessaging.js";

/**
 * Hook for managing volume state and slider interaction.
 * @param {number|null} currentTabId - The current tab ID
 * @param {function} throttledEnsureBackend - Throttled backend ready function
 * @returns {{
 *   volume: number,
 *   setVolume: function,
 *   handleVolumeStart: function
 * }}
 */
export function useVolumeControl(currentTabId, throttledEnsureBackend) {
  const [volume, setVolumeState] = useState(1);

  // Sets the master volume in the offscreen audio context.
  const setVolume = useCallback(
    async (value) => {
      await sendMessage({
        type: MSG.SET_VOLUME,
        value,
        tabId: currentTabId,
      });
    },
    [currentTabId],
  );

  // Handles volume slider mouse down event (with throttled backend ensure).
  const handleVolumeStart = useCallback(
    (e) => {
      throttledEnsureBackend();

      const rect = e.currentTarget.getBoundingClientRect();

      function move(ev) {
        const y = ev.clientY - rect.top + 3;
        const ratio = 1 - Math.min(Math.max(y / rect.height, 0), 1);

        // Map ratio [0, 1] to dB [-30, 10]
        // At ratio=0 (bottom): gain=0
        // At ratio=0.75 (3/4 up): gain=1 (0dB)
        // At ratio=1 (top): gain≈3.162 (+10dB)
        let gain;
        if (ratio === 0) {
          gain = 0;
        } else {
          const db = -30 + ratio * 40;
          gain = Math.pow(10, db / 20);
        }

        setVolumeState(gain);
        // Send volume update to backend
        sendMessage({
          type: MSG.SET_VOLUME,
          value: gain,
          tabId: currentTabId,
        });
      }

      window.addEventListener("mousemove", move);
      window.addEventListener(
        "mouseup",
        () => window.removeEventListener("mousemove", move),
        { once: true },
      );
    },
    [currentTabId, throttledEnsureBackend],
  );

  return {
    volume,
    setVolumeState,
    setVolume,
    handleVolumeStart,
  };
}
