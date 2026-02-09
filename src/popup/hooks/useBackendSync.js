// src/popup/hooks/useBackendSync.js
// Hook for managing background/offscreen service worker coordination.
// Handles pinging, reinitialization, and state rehydration with throttling.

import { useRef, useCallback } from "react";
import { sendMessage, MSG } from "../../lib/chromeMessaging.js";
import {
  calculateQ,
  DEFAULT_PEAKING_Q,
  DEFAULT_SHELF_Q,
} from "../../lib/qCalculations.js";

/**
 * Hook for backend synchronization with throttling.
 * Ensures background and offscreen service workers are ready before critical operations.
 *
 * @param {number|null} currentTabId - Active tab ID
 * @param {Object} nodeGainValues - Current gain values for rehydration
 * @param {Object} nodeFrequencyValues - Current frequency values for rehydration
 * @param {Object} nodeBaseQValues - Current baseQ values for rehydration
 * @returns {Object} { ensureBackendReady, throttledEnsureBackend }
 */
export function useBackendSync(
  currentTabId,
  nodeGainValues,
  nodeFrequencyValues,
  nodeBaseQValues,
) {
  // Throttle tracking for ensuring backend is ready (1 second cooldown)
  const lastEnsureTimeRef = useRef(0);

  /**
   * Ensure background and offscreen are ready by pinging BG and reinitializing missing audio.
   * Call this before critical operations to guarantee service worker and offscreen are alive.
   */
  const ensureBackendReady = useCallback(async () => {
    // Ping background until it's ready
    for (let i = 0; i < 40; i++) {
      const ping = await sendMessage({ type: MSG.PING_BG });
      if (ping?.ok) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    // Reinitialize any missing audio graphs in offscreen
    await sendMessage({ type: MSG.REINIT_MISSING_AUDIO });

    // Rehydrate Web Audio API with current UI state (fallback if no saved state)
    if (currentTabId && Object.keys(nodeGainValues).length > 0) {
      // Recalculate Q values from baseQ and current gains before sending
      const recalculatedQValues = {};
      for (let i = 0; i < 13; i++) {
        const isShelf = i === 2 || i === 12;
        const baseQ =
          nodeBaseQValues[i] ?? (isShelf ? DEFAULT_SHELF_Q : DEFAULT_PEAKING_Q);
        const gain = nodeGainValues[i] ?? 0;
        recalculatedQValues[i] = calculateQ(i, baseQ, gain);
      }

      await sendMessage({
        type: MSG.UPDATE_EQ_NODES,
        tabId: currentTabId,
        nodeGainValues,
        nodeFrequencyValues,
        nodeQValues: recalculatedQValues,
      });
    }
  }, [currentTabId, nodeGainValues, nodeFrequencyValues, nodeBaseQValues]);

  /**
   * Throttled version of ensureBackendReady with 1 second cooldown.
   * Safe to call frequently without performance impact.
   */
  const throttledEnsureBackend = useCallback(async () => {
    const now = Date.now();
    if (now - lastEnsureTimeRef.current < 1000) {
      return; // Skip if called within last 1 second
    }
    lastEnsureTimeRef.current = now;
    await ensureBackendReady();
  }, [ensureBackendReady]);

  return {
    ensureBackendReady,
    throttledEnsureBackend,
  };
}
