// background/background.js
// MV3 service worker acting as the control plane for the extension.
// Responsibilities:
// - Wake up on demand
// - Manage offscreen document lifecycle
// - Capture tab audio permissions
// - Relay control messages between popup and offscreen

console.log("[BG] Service worker loaded");

// Map<tabId, { streamId, status }> — tracks EQ sessions per tab.
// Multiple tabs can have active EQ simultaneously.
// This is the single source of truth for EQ state.
const eqSessions = new Map();

// Guard to prevent concurrent START_EQ calls for the same tab.
// Important because popup clicks and MV3 wakeups can overlap.
const startingTabs = new Set();

// MV3 NOTE (IMPORTANT):
// Background service worker is ephemeral and loses memory after ~30s idle.
// Offscreen audio graphs may still be alive when this file reloads.
// On startup, immediately query offscreen for currently active tabIds
// and rehydrate eqSessions from that response.
// eqSessions must be rebuilt from offscreen state on every service worker load.
async function rehydrateEqSessions() {
  try {
    console.log("[BG] Rehydrating eqSessions from offscreen...");

    const res = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "GET_ACTIVE_TABS" }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(response);
      });
    });

    if (res?.ok && Array.isArray(res?.tabIds)) {
      // Get the streamIds for all active tabs
      const streamIdsRes = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "GET_STREAM_IDS" }, (response) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(response);
        });
      });

      const streamIds = streamIdsRes?.streamIds ?? {};

      res.tabIds.forEach((tabId) => {
        // Reconstruct session entry with actual streamId from offscreen
        eqSessions.set(tabId, {
          streamId: streamIds[tabId] || null,
          status: "active",
        });
      });
      console.log("[BG] Rehydrated eqSessions for", res.tabIds.length, "tabs");
    }
  } catch (e) {
    console.warn("[BG] Failed to rehydrate eqSessions:", e);
    // Continue anyway; if offscreen is not ready, queries will fail gracefully
  }
}

// Rehydrate on service worker startup
(async () => {
  try {
    // Ensure offscreen exists before querying it
    await ensureOffscreen();
    // Now safely rehydrate
    await rehydrateEqSessions();
  } catch (e) {
    console.warn("[BG] Startup rehydration failed:", e);
  }
})();

// Ensure an offscreen document exists.
// Offscreen documents are required in MV3 for audio processing.
// This function is idempotent and safe to call multiple times.
async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    console.log("[BG] Creating offscreen document…");
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"], // Required for Web Audio usage
      justification: "Audio processing for EQ extension",
    });
    console.log("[BG] Offscreen document created");
  }
}

// Send a message to the offscreen document and await its response.
// Wrapped in a Promise so callers can use async/await.
// Rejects on runtime errors (unlike popup-side sendMessage).
function sendToOffscreen(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(err);
      resolve(res);
    });
  });
}

// Starts EQ processing for a specific tab.
// This function:
// 1) Ensures offscreen exists (shared across all tabs)
// 2) Requests a tab audio stream ID
// 3) Delegates audio initialization to offscreen for this tabId
async function startEqForTab(tabId) {
  // Prevent re-entrancy / race conditions per tab
  if (startingTabs.has(tabId)) return { ok: true, alreadyStarting: true };
  startingTabs.add(tabId);

  try {
    // Guarantee offscreen document is alive before capture
    await ensureOffscreen();

    if (!tabId) return { ok: false, error: "No tab ID provided" };

    // Check if EQ is already active for this tab
    if (eqSessions.has(tabId)) {
      console.log("[BG] EQ already active for tab:", tabId);
      return { ok: true, alreadyActive: true };
    }

    console.log("[BG] Starting EQ for tab:", tabId);

    // Request a streamId token for tab audio capture.
    // This does NOT start playback — it only grants permission.
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    // Register this tab as having an active EQ session
    eqSessions.set(tabId, { streamId, status: "starting" });

    // Ask offscreen to initialize audio graph for this specific tabId.
    // We await acknowledgment to ensure audio is fully ready.
    const res = await sendToOffscreen({
      type: "INIT_AUDIO",
      streamId,
      tabId,
    });

    console.log("[BG] Offscreen INIT_AUDIO ack for tab", tabId, ":", res);

    if (res?.ok) {
      eqSessions.get(tabId).status = "active";
    }

    return { ok: true };
  } catch (e) {
    console.warn("[BG] startEqForTab failed:", e);
    eqSessions.delete(tabId);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    // Always release the re-entrancy lock for this tab
    startingTabs.delete(tabId);
  }
}

// Listen for tab closes and clean up EQ sessions for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (eqSessions.has(tabId)) {
    console.log("[BG] Tab removed, cleaning up EQ for tab:", tabId);

    (async () => {
      try {
        // Wait for offscreen to fully cleanup this tab's audio
        await sendToOffscreen({
          type: "STOP_EQ",
          tabId,
        });

        eqSessions.delete(tabId);
      } catch (e) {
        console.warn("[BG] Failed to cleanup tab", tabId, ":", e);
        eqSessions.delete(tabId); // Cleanup session even on error
      }
    })();
  }
});

// Central message router for popup → background → offscreen.
// This listener must be synchronous in structure but can
// delegate async work via IIFEs and return true.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // =====================
  // PING_BG
  // =====================
  // Simple handshake used by the popup to wake the MV3 service worker
  // and confirm it is ready to receive commands.
  if (msg?.type === "PING_BG") {
    sendResponse({ ok: true });
    return true;
  }

  // =====================
  // START_EQ
  // =====================
  // Initiates EQ processing for a specific tab.
  // Message must include tabId. Safe to call multiple times due to internal guards.
  if (msg?.type === "START_EQ") {
    (async () => {
      const tabId = msg.tabId;
      const result = await startEqForTab(tabId);
      sendResponse(result);
    })();
    return true; // keep message port open
  }

  // =====================
  // STOP_EQ
  // =====================
  // Stops EQ processing for a specific tab.
  // This includes:
  // - Tearing down the tab's audio graph (offscreen)
  // - Removing the tab from the sessions map
  // - Closing offscreen ONLY if no tabs remain active
  if (msg?.type === "STOP_EQ") {
    (async () => {
      const tabId = msg.tabId;

      try {
        // Remove from sessions before cleanup
        eqSessions.delete(tabId);

        // Ask offscreen to stop audio and release media tracks for this tab
        const res = await sendToOffscreen({
          type: "STOP_EQ",
          tabId,
        });

        sendResponse(res ?? { ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  // =====================
  // SET_VOLUME
  // =====================
  // Forward volume updates directly to offscreen for a specific tab.
  // Background does not interpret or store volume values.
  if (msg?.type === "SET_VOLUME") {
    (async () => {
      try {
        const res = await sendToOffscreen({
          type: "SET_VOLUME",
          value: msg.value,
          tabId: msg.tabId,
        });
        sendResponse(res ?? { ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  // =====================
  // GET_EQ_STATUS
  // =====================
  // Returns whether EQ is active for a specific tab.
  if (msg?.type === "GET_EQ_STATUS") {
    const tabId = msg.tabId;
    const isActive = eqSessions.has(tabId);
    sendResponse({ ok: true, active: isActive });
    return true;
  }

  // =====================
  // GET_VOLUME
  // =====================
  // Forward volume query to offscreen for a specific tab.
  if (msg?.type === "GET_VOLUME") {
    (async () => {
      try {
        const res = await sendToOffscreen({
          type: "GET_VOLUME",
          tabId: msg.tabId,
        });
        sendResponse(res ?? { ok: true, gain: 1.0 });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  // =====================
  // GET_ALL_ACTIVE_TABS
  // =====================
  // Returns an array of all tab IDs with active EQ sessions.
  if (msg?.type === "GET_ALL_ACTIVE_TABS") {
    const activeTabIds = Array.from(eqSessions.keys());
    sendResponse({ ok: true, tabIds: activeTabIds });
    return true;
  }

  // =====================
  // REINIT_MISSING_AUDIO
  // =====================
  // Called by popup on mount to ensure all active EQ sessions
  // have their audio graphs in offscreen.
  // Handles the case where BG stays alive but offscreen crashes.
  if (msg?.type === "REINIT_MISSING_AUDIO") {
    (async () => {
      try {
        // Ensure offscreen exists (recreate if it crashed)
        await ensureOffscreen();

        const activeTabIds = Array.from(eqSessions.keys());

        if (activeTabIds.length === 0) {
          sendResponse({ ok: true, reinitialized: [] });
          return;
        }

        // Query offscreen for which audio graphs are still active
        const offscreenStatus = await sendToOffscreen({
          type: "GET_ACTIVE_TABS",
        });

        const offscreenTabIds = offscreenStatus?.tabIds ?? [];
        const offscreenSet = new Set(offscreenTabIds);

        // Find sessions that are in BG but not in offscreen
        const missingTabs = activeTabIds.filter(
          (tabId) => !offscreenSet.has(tabId)
        );

        console.log(
          "[BG] Found",
          missingTabs.length,
          "sessions missing from offscreen, reinitializing..."
        );

        const reinitialized = [];

        // Reinitialize audio for each missing tab
        for (const tabId of missingTabs) {
          try {
            // Get a fresh streamId (old one may be stale/expired)
            const freshStreamId = await chrome.tabCapture.getMediaStreamId({
              targetTabId: tabId,
            });

            const res = await sendToOffscreen({
              type: "INIT_AUDIO",
              streamId: freshStreamId,
              tabId,
            });

            if (res?.ok) {
              eqSessions.get(tabId).streamId = freshStreamId;
              eqSessions.get(tabId).status = "active";
              reinitialized.push(tabId);
              console.log("[BG] Reinitialized audio for tab", tabId);
            }
          } catch (e) {
            console.warn("[BG] Failed to reinit tab", tabId, ":", e);
          }
        }

        sendResponse({ ok: true, reinitialized });
      } catch (e) {
        console.warn("[BG] REINIT_MISSING_AUDIO failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }
});
