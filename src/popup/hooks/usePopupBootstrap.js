import { useState, useEffect } from "react";
import { sendMessage, MSG } from "../../lib/chromeMessaging.js";
import { loadEqStateFromLocalStorage } from "../../lib/eqStateUtils.js";

/**
 * Hook for bootstrapping the popup on mount.
 * Handles tab detection, volume fetch, backend init, EQ status check, and state hydration.
 *
 * @param {function} ensureBackendReady - Function to ensure backend is ready
 * @param {function} initializeEqState - Function to initialize EQ state from gain/freq/Q values
 * @param {function} setEqStateFromLocalStorage - Function to set all EQ state from localStorage
 * @returns {{
 *   currentTabId: number|null,
 *   eqActive: boolean,
 *   setEqActive: function,
 *   volume: number,
 *   setVolumeState: function
 * }}
 */
export function usePopupBootstrap(
  ensureBackendReady,
  initializeEqState,
  setEqStateFromLocalStorage,
) {
  const [currentTabId, setCurrentTabId] = useState(null);
  const [eqActive, setEqActive] = useState(true);
  const [volume, setVolumeState] = useState(1);

  // On mount, ensure backend is ready and check if EQ is already active for this tab.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (cancelled || !tab?.id) return;

      setCurrentTabId(tab.id);

      // Get the current volume for this tab
      const volumeStatus = await sendMessage({
        type: MSG.GET_VOLUME,
        tabId: tab.id,
      });

      if (volumeStatus?.ok && volumeStatus?.gain) {
        setVolumeState(volumeStatus.gain);
      } else {
        // Fallback: load volume from localStorage
        const savedState = loadEqStateFromLocalStorage();
        if (savedState?.volume !== undefined) {
          setVolumeState(savedState.volume);
        }
      }

      if (cancelled) return;

      // Ensure backend is ready FIRST before fetching from Web Audio API
      await ensureBackendReady();

      if (cancelled) return;

      const status = await sendMessage({
        type: MSG.GET_EQ_STATUS,
        tabId: tab.id,
      });

      if (status?.active) {
        setEqActive(true);
      }

      if (cancelled) return;

      // Check if we need to START_EQ
      if (!status?.active) {
        // Auto-start EQ for this tab if not already active
        const res = await sendMessage({ type: MSG.START_EQ, tabId: tab.id });
        if (res?.ok) setEqActive(true);

        if (cancelled) return;

        // Give offscreen time to initialize audio graphs
        await new Promise((r) => setTimeout(r, 150));
      }

      // PRIMARY: Fetch current EQ state from Web Audio API (source of truth)
      let webAudioState = null;
      try {
        const eqNodeStatus = await sendMessage({
          type: MSG.GET_EQ_NODES,
          tabId: tab.id,
        });

        if (eqNodeStatus?.ok) {
          const gainValues = eqNodeStatus.nodeGainValues || {};
          const freqValues = eqNodeStatus.nodeFrequencyValues || {};
          const qValues = eqNodeStatus.nodeQValues || {};

          // If Web Audio API has values, use them as source of truth
          if (Object.keys(gainValues).length > 0) {
            webAudioState = {
              gainValues,
              freqValues,
              qValues,
            };
            initializeEqState(gainValues, freqValues, qValues);
            console.log(
              "[Popup] Web Audio API has EQ state, using it as source of truth",
            );
          }
        }
      } catch (e) {
        console.warn("[Popup] Failed to fetch EQ state from Web Audio API:", e);
      }

      if (cancelled) return;

      // FALLBACK: If Web Audio API had no state, load from localStorage
      if (!webAudioState) {
        const savedState = loadEqStateFromLocalStorage();
        if (savedState) {
          setEqStateFromLocalStorage(savedState, tab.id);
          // Also restore volume from localStorage if available
          if (savedState.volume !== undefined) {
            setVolumeState(savedState.volume);
            sendMessage({
              type: MSG.SET_VOLUME,
              value: savedState.volume,
              tabId: tab.id,
            });
          }
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    currentTabId,
    eqActive,
    setEqActive,
    volume,
    setVolumeState,
  };
}
