// offscreen/offscreen.js
// This script runs inside a Chrome MV3 offscreen document.
// Its sole responsibility is owning the Web Audio graph and tab audio capture.
// Background and popup must NEVER touch Web Audio directly.

console.log("[OFFSCREEN] Offscreen audio script loaded");

// Persistent audio state for the lifetime of the offscreen document.
// These variables survive popup open/close and background idle.
let audioContext; // Web Audio context (must live in offscreen in MV3)
let sourceNode; // MediaStreamAudioSourceNode (tab audio input)
let gainNode; // Master volume control
let currentTabId; // Tab currently being processed
let mediaStream; // Raw MediaStream from tabCapture (must be stopped explicitly)

// Runtime message handler for background → offscreen control messages.
// Wrapped in an async IIFE to allow `await` inside.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // =====================
    // INIT_AUDIO
    // =====================
    // Creates the audio pipeline for the active tab.
    // This should only run once per EQ session.
    if (msg?.type === "INIT_AUDIO") {
      try {
        // Guard against double initialization
        // (prevents multiple AudioContexts and duplicate capture)
        if (audioContext) {
          console.log("[OFFSCREEN] Audio already initialized");
          sendResponse({
            ok: true,
            alreadyInitialized: true,
            tabId: currentTabId,
          });
          return;
        }

        console.log("[OFFSCREEN] Initializing AudioContext…");

        // Create the Web Audio context.
        // Chrome may start it in a suspended state, so we resume explicitly.
        audioContext = new AudioContext();
        await audioContext.resume(); // avoids silent-audio edge cases

        // Capture audio from the specified tab using the streamId
        // provided by chrome.tabCapture.getMediaStreamId().
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: msg.streamId,
            },
          },
        });

        // Track which tab this EQ instance belongs to
        currentTabId = msg.tabId;

        // Build the audio graph:
        // Tab Audio → Gain → Speakers
        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        gainNode = audioContext.createGain();

        // Unity gain by default (no volume change)
        gainNode.gain.value = 1.0;

        sourceNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        console.log(
          "[OFFSCREEN] Audio pipeline ready (source → gain → destination)"
        );

        // Acknowledge successful initialization back to background
        sendResponse({ ok: true, tabId: currentTabId });
        return;
      } catch (e) {
        // Any failure here means audio capture or graph creation failed
        console.warn("[OFFSCREEN] INIT_AUDIO failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
        return;
      }
    }

    // =====================
    // SET_VOLUME
    // =====================
    // Adjusts master gain in real time.
    // Does NOT recreate audio or affect capture lifecycle.
    if (msg?.type === "SET_VOLUME") {
      if (gainNode) {
        // Set gain immediately at the current audio time
        gainNode.gain.setValueAtTime(msg.value, audioContext.currentTime);
      }
      sendResponse({ ok: true });
      return;
    }

    // =====================
    // STOP_EQ
    // =====================
    // Fully tears down the audio pipeline AND releases tab capture.
    // Stopping MediaStream tracks is critical to release Chrome’s
    // “tab is being shared” state.
    if (msg?.type === "STOP_EQ") {
      try {
        // Disconnect audio nodes first
        if (sourceNode) sourceNode.disconnect();
        if (gainNode) gainNode.disconnect();

        // Explicitly stop all media tracks
        // (closing AudioContext alone is NOT enough)
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
          mediaStream = null;
        }

        // Close the AudioContext to release audio resources
        if (audioContext) {
          await audioContext.close();
        }

        // Reset all state so EQ can be cleanly restarted
        audioContext = null;
        sourceNode = null;
        gainNode = null;
        currentTabId = null;

        console.log("[OFFSCREEN] Audio + tab capture fully released");
        sendResponse({ ok: true });
      } catch (e) {
        console.warn("[OFFSCREEN] STOP_EQ failed:", e);
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
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
