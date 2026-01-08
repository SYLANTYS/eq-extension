// background/background.js
// MV3 service worker acting as the control plane for the extension.
// Responsibilities:
// - Wake up on demand
// - Manage offscreen document lifecycle
// - Capture tab audio permissions
// - Relay control messages between popup and offscreen
// This file NEVER touches Web Audio directly.

console.log("[BG] Service worker loaded");

// Guard to prevent concurrent START_EQ calls.
// Important because popup clicks and MV3 wakeups can overlap.
let starting = false;

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

// Starts EQ processing for the currently active tab.
// This function:
// 1) Ensures offscreen exists
// 2) Identifies the active tab
// 3) Requests a tab audio stream ID
// 4) Delegates audio initialization to offscreen
async function startEqForActiveTab() {
  // Prevent re-entrancy / race conditions
  if (starting) return { ok: true, alreadyStarting: true };
  starting = true;

  try {
    // Guarantee offscreen document is alive before capture
    await ensureOffscreen();

    // Get the active tab in the current window
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return { ok: false, error: "No active tab" };

    console.log("[BG] Starting EQ for tab:", tab.id);

    // Request a streamId token for tab audio capture.
    // This does NOT start playback — it only grants permission.
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });

    // Ask offscreen to initialize its audio graph using the streamId.
    // We await acknowledgment to ensure audio is fully ready.
    const res = await sendToOffscreen({
      type: "INIT_AUDIO",
      streamId,
      tabId: tab.id,
    });

    console.log("[BG] Offscreen INIT_AUDIO ack:", res);
    return { ok: true };
  } catch (e) {
    console.warn("[BG] startEqForActiveTab failed:", e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    // Always release the re-entrancy lock
    starting = false;
  }
}

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
  // Initiates EQ processing for the active tab.
  // Safe to call multiple times due to internal guards.
  if (msg?.type === "START_EQ") {
    (async () => {
      const result = await startEqForActiveTab();
      sendResponse(result);
    })();
    return true; // keep message port open
  }

  // =====================
  // STOP_EQ
  // =====================
  // Fully stops audio processing and releases all resources.
  // This includes:
  // - Tearing down the audio graph (offscreen)
  // - Releasing tab capture
  // - Explicitly closing the offscreen document
  if (msg?.type === "STOP_EQ") {
    (async () => {
      try {
        // Ask offscreen to stop audio and release media tracks
        const res = await sendToOffscreen({ type: "STOP_EQ" });

        // Explicitly destroy the offscreen document.
        // This guarantees Chrome releases all offscreen resources.
        await chrome.offscreen.closeDocument();

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
  // Forward volume updates directly to offscreen.
  // Background does not interpret or store volume values.
  if (msg?.type === "SET_VOLUME") {
    chrome.runtime.sendMessage({ type: "SET_VOLUME", value: msg.value }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
