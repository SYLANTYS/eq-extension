// offscreen/offscreen.js
// This script runs inside a Chrome MV3 offscreen document.
// Its sole responsibility is owning the Web Audio graph and tab audio capture.
// Background and popup must NEVER touch Web Audio directly.

console.log("[OFFSCREEN] Offscreen audio script loaded");

// Q-factor configuration constants (must match Popup.jsx and Controls.jsx)
const Q_MULTIPLIER = 1.5; // Multiplier for gain-dependent Q calculation
const DEFAULT_PEAKING_Q = 0.3; // Default Q for peaking filters
const DEFAULT_SHELF_Q = 0.75; // Default Q for shelf filters

// Map<tabId, { audioContext, sourceNode, gainNode, mediaStream, eqFilters, analyserNode }>
// Stores isolated audio graphs, one per tab.
// Multiple tabs can have active audio simultaneously.
// eqFilters: array of 11 BiquadFilterNode instances (indices 2-12)
// analyserNode: analyser for real-time spectrum data
const audioGraphs = new Map();

// Standard frequency bands used in audio processing (must match Controls.jsx)
const FREQUENCIES = [
  5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
];

// Create EQ filter nodes for a given audio graph
// Returns array of 13 biquad filters (indices 0-1 are transparent, 2-12 are interactive)
function createEqFilters(audioContext) {
  const filters = [];

  // Create 13 biquad filter nodes (matching Controls.jsx frequency array)
  for (let i = 0; i < FREQUENCIES.length; i++) {
    const biquad = audioContext.createBiquadFilter();
    biquad.frequency.value = FREQUENCIES[i];
    biquad.gain.value = 0; // No boost/cut by default

    // Determine filter type based on index
    if (i === 0 || i === 1) {
      // Inactive indices (5Hz, 10Hz) - set to peaking to pass through transparently
      biquad.type = "peaking";
      biquad.Q.value = DEFAULT_PEAKING_Q;
    } else if (i === 2) {
      // Low shelf (80 Hz)
      biquad.type = "lowshelf";
      biquad.Q.value = DEFAULT_SHELF_Q;
    } else if (i === 12) {
      // High shelf (20.48 kHz)
      biquad.type = "highshelf";
      biquad.Q.value = DEFAULT_SHELF_Q;
    } else if (i >= 3 && i <= 11) {
      // Mid-range peaking filters
      biquad.type = "peaking";
      biquad.Q.value = DEFAULT_PEAKING_Q;
    }

    filters.push(biquad);
  }

  return filters;
}

// Connect EQ filters in series: source → filter[0] → filter[1] → ... → destination
function connectEqChain(
  sourceNode,
  filters,
  gainNode,
  destination,
  analyserNode = null,
) {
  let previousNode = sourceNode;

  // Connect all filters in series
  for (const filter of filters) {
    previousNode.connect(filter);
    previousNode = filter;
  }

  // Final connection: last filter → gain → destination
  previousNode.connect(gainNode);
  gainNode.connect(destination);

  // Also tap off analyser from the gain node for spectrum analysis
  if (analyserNode) {
    gainNode.connect(analyserNode);
  }
}

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
        // Tab Audio → EQ Filters (series) → Gain → Speakers + Analyser
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);
        const gainNode = audioContext.createGain();
        const eqFilters = createEqFilters(audioContext);
        const analyserNode = audioContext.createAnalyser();

        // Configure analyser for spectrum data
        analyserNode.fftSize = 2048; // Higher FFT size for better frequency resolution
        analyserNode.smoothingTimeConstant = 0.85;

        // Unity gain by default (no volume change)
        gainNode.gain.value = 1.0;

        // Connect: source → eqFilters (series) → gain → destination + analyser
        connectEqChain(
          sourceNode,
          eqFilters,
          gainNode,
          audioContext.destination,
          analyserNode,
        );

        // Store this tab's audio graph including EQ filters and analyser
        audioGraphs.set(tabId, {
          audioContext,
          sourceNode,
          gainNode,
          mediaStream,
          streamId: msg.streamId,
          eqFilters,
          analyserNode,
        });

        console.log(
          "[OFFSCREEN] Audio pipeline ready for tab",
          tabId,
          "(source → 13 EQ filters → gain → destination)",
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
          graph.audioContext.currentTime,
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
          tabId,
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
    // GET_STREAM_IDS
    // =====================
    // Returns a map of tabId -> streamId for all active audio graphs.
    // Used by background worker to rehydrate eqSessions with actual streamIds.
    if (msg?.type === "GET_STREAM_IDS") {
      const streamIds = {};
      for (const [tabId, graph] of audioGraphs.entries()) {
        streamIds[tabId] = graph.streamId;
      }
      sendResponse({ ok: true, streamIds });
      return;
    }

    // =====================
    // UPDATE_EQ_NODES
    // =====================
    // Updates EQ filter parameters for a specific tab.
    // Expects: {
    //   nodeGainValues: { [index]: dB },
    //   nodeFrequencyValues: { [index]: Hz },
    //   nodeQValues: { [index]: Q },
    //   nodeBaseQValues: { [index]: baseQ }
    // }
    if (msg?.type === "UPDATE_EQ_NODES") {
      try {
        const graph = audioGraphs.get(tabId);
        if (!graph || !graph.eqFilters) {
          sendResponse({ ok: false, error: "No audio graph for tab" });
          return;
        }

        const { nodeGainValues, nodeFrequencyValues, nodeQValues } = msg;

        // Update each filter that has changed
        for (let i = 0; i < FREQUENCIES.length; i++) {
          const filter = graph.eqFilters[i];

          if (nodeFrequencyValues && i in nodeFrequencyValues) {
            filter.frequency.setValueAtTime(
              nodeFrequencyValues[i],
              graph.audioContext.currentTime,
            );
          }

          if (nodeQValues && i in nodeQValues) {
            filter.Q.setValueAtTime(
              nodeQValues[i],
              graph.audioContext.currentTime,
            );
          }

          if (nodeGainValues && i in nodeGainValues) {
            filter.gain.setValueAtTime(
              nodeGainValues[i],
              graph.audioContext.currentTime,
            );
          }
        }

        sendResponse({ ok: true });
        return;
      } catch (e) {
        console.warn("[OFFSCREEN] UPDATE_EQ_NODES failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    }

    // =====================
    // GET_EQ_NODES
    // =====================
    // Returns current EQ filter parameters for a specific tab.
    // Used during initialization to populate UI state from Web Audio API.
    if (msg?.type === "GET_EQ_NODES") {
      try {
        const graph = audioGraphs.get(tabId);
        if (!graph || !graph.eqFilters) {
          sendResponse({ ok: false, error: "No audio graph for tab" });
          return;
        }

        const nodeGainValues = {};
        const nodeFrequencyValues = {};
        const nodeQValues = {};

        // Read current filter values
        for (let i = 0; i < FREQUENCIES.length; i++) {
          const filter = graph.eqFilters[i];

          // Only include non-default values
          if (filter.gain.value !== 0) {
            nodeGainValues[i] = filter.gain.value;
          }

          nodeFrequencyValues[i] = filter.frequency.value;
          nodeQValues[i] = filter.Q.value;
        }

        sendResponse({
          ok: true,
          nodeGainValues,
          nodeFrequencyValues,
          nodeQValues,
        });
        return;
      } catch (e) {
        console.warn("[OFFSCREEN] GET_EQ_NODES failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    }

    // =====================
    // GET_SPECTRUM_DATA
    // =====================
    // Returns real-time frequency spectrum data for a specific tab.
    // Used by popup to render spectrum visualizer in Controls component.
    if (msg?.type === "GET_SPECTRUM_DATA") {
      try {
        const graph = audioGraphs.get(tabId);
        if (!graph || !graph.analyserNode) {
          sendResponse({ ok: false, error: "No audio graph for tab" });
          return;
        }

        // Get frequency data from analyser
        const dataArray = new Uint8Array(graph.analyserNode.frequencyBinCount);
        graph.analyserNode.getByteFrequencyData(dataArray);

        // Convert to array for transmission
        const spectrumData = Array.from(dataArray);

        sendResponse({
          ok: true,
          spectrumData,
          binCount: graph.analyserNode.frequencyBinCount,
        });
        return;
      } catch (e) {
        console.warn("[OFFSCREEN] GET_SPECTRUM_DATA failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
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
