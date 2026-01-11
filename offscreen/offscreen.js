// offscreen/offscreen.js
// This script runs inside a Chrome MV3 offscreen document.
// Its sole responsibility is owning the Web Audio graph and tab audio capture.
// Background and popup must NEVER touch Web Audio directly.

console.log("[OFFSCREEN] Offscreen audio script loaded");

// Map<tabId, { audioContext, sourceNode, gainNode, mediaStream }>
// Stores isolated audio graphs, one per tab.
// Multiple tabs can have active audio simultaneously.
const audioGraphs = new Map();

// Runtime message handler for background → offscreen control messages.
// Wrapped in an async IIFE to allow `await` inside.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const tabId = msg?.tabId;

    // =====================
    // INIT_AUDIO
    // =====================
    // Creates the audio pipeline for a specific tab.
    // Multiple tabs can have independent audio graphs simultaneously.
    if (msg?.type === "INIT_AUDIO") {
      try {
        // Guard against double initialization for the same tab
        if (audioGraphs.has(tabId)) {
          console.log("[OFFSCREEN] Audio already initialized for tab", tabId);
          sendResponse({
            ok: true,
            alreadyInitialized: true,
            tabId,
          });
          return;
        }

        if (!tabId) {
          sendResponse({ ok: false, error: "No tabId provided" });
          return;
        }

        console.log("[OFFSCREEN] Initializing AudioContext for tab", tabId);

        // Create a Web Audio context for this tab.
        // Chrome may start it in a suspended state, so we resume explicitly.
        const audioContext = new AudioContext();
        await audioContext.resume(); // avoids silent-audio edge cases

        // Capture audio from the specified tab using the streamId
        // provided by chrome.tabCapture.getMediaStreamId().
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: msg.streamId,
            },
          },
        });

        // Build the audio graph for this tab:
        // Tab Audio → Gain → Speakers
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);
        const gainNode = audioContext.createGain();

        // Unity gain by default (no volume change)
        gainNode.gain.value = 1.0;

        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Store this tab's audio graph
        audioGraphs.set(tabId, {
          audioContext,
          sourceNode,
          gainNode,
          mediaStream,
        });

        console.log(
          "[OFFSCREEN] Audio pipeline ready for tab",
          tabId,
          "(source → gain → destination)"
        );

        sendResponse({ ok: true, tabId });
        return;
      } catch (e) {
        console.warn("[OFFSCREEN] INIT_AUDIO failed for tab", tabId, ":", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
        return;
      }
    }

    // =====================
    // SET_VOLUME
    // =====================
    // Adjusts master gain for a specific tab in real time.
    // Does NOT recreate audio or affect capture lifecycle.
    if (msg?.type === "SET_VOLUME") {
      const graph = audioGraphs.get(tabId);
      if (graph?.gainNode) {
        // Set gain immediately at the current audio time
        graph.gainNode.gain.setValueAtTime(
          msg.value,
          graph.audioContext.currentTime
        );
      }
      sendResponse({ ok: true });
      return;
    }

    // =====================
    // GET_VOLUME
    // =====================
    // Returns the current gain value for a specific tab.
    if (msg?.type === "GET_VOLUME") {
      const graph = audioGraphs.get(tabId);
      const gain = graph?.gainNode?.gain.value ?? 1.0;
      sendResponse({ ok: true, gain });
      return;
    }

    // =====================
    // STOP_EQ
    // =====================
    // Fully tears down the audio pipeline for a specific tab.
    // Does NOT affect other tabs' audio graphs.
    // Stopping MediaStream tracks is critical to release Chrome's
    // "tab is being shared" state.
    if (msg?.type === "STOP_EQ") {
      try {
        const graph = audioGraphs.get(tabId);

        if (!graph) {
          console.log("[OFFSCREEN] No audio graph found for tab", tabId);
          sendResponse({ ok: true });
          return;
        }

        // Disconnect audio nodes for this tab
        if (graph.sourceNode) graph.sourceNode.disconnect();
        if (graph.gainNode) graph.gainNode.disconnect();

        // Explicitly stop all media tracks for this tab
        // (closing AudioContext alone is NOT enough)
        if (graph.mediaStream) {
          graph.mediaStream.getTracks().forEach((track) => track.stop());
        }

        // Close the AudioContext for this tab
        if (graph.audioContext) {
          await graph.audioContext.close();
        }

        // Remove from map
        audioGraphs.delete(tabId);

        console.log(
          "[OFFSCREEN] Audio + tab capture fully released for tab",
          tabId
        );
        sendResponse({ ok: true });
      } catch (e) {
        console.warn("[OFFSCREEN] STOP_EQ failed for tab", tabId, ":", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
      return;
    }

    // =====================
    // GET_ACTIVE_TABS
    // =====================
    // Returns the list of tabIds that currently have active audio graphs.
    // Used by background worker on startup to rehydrate eqSessions
    // after service worker reload.
    if (msg?.type === "GET_ACTIVE_TABS") {
      const activeTabIds = Array.from(audioGraphs.keys());
      sendResponse({ ok: true, tabIds: activeTabIds });
      return;
    }

    // =====================
    // Fallback
    // =====================
    // Gracefully ignore unknown messages to avoid
    // leaving message ports hanging.
    sendResponse({ ok: true, ignored: true });
  })();

  // Required for async sendResponse in MV3
  return true;
});
