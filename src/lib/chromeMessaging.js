// src/lib/chromeMessaging.js
// Centralized Chrome extension messaging utility.
// Use this instead of chrome.runtime.sendMessage directly for consistent error handling.

/**
 * Message type constants for communication between popup, background, and offscreen.
 * Using constants prevents typos and enables IDE autocomplete.
 */
export const MSG = {
  // Background coordination
  PING_BG: "PING_BG",
  REINIT_MISSING_AUDIO: "REINIT_MISSING_AUDIO",

  // EQ lifecycle
  START_EQ: "START_EQ",
  STOP_EQ: "STOP_EQ",
  GET_EQ_STATUS: "GET_EQ_STATUS",

  // EQ node control
  UPDATE_EQ_NODES: "UPDATE_EQ_NODES",
  GET_EQ_NODES: "GET_EQ_NODES",

  // Volume control
  SET_VOLUME: "SET_VOLUME",
  GET_VOLUME: "GET_VOLUME",

  // Audio/tab management
  INIT_AUDIO: "INIT_AUDIO",
  GET_ACTIVE_TABS: "GET_ACTIVE_TABS",
  GET_ALL_ACTIVE_TABS: "GET_ALL_ACTIVE_TABS",
  GET_STREAM_IDS: "GET_STREAM_IDS",

  // Spectrum visualization
  GET_SPECTRUM_DATA: "GET_SPECTRUM_DATA",

  // Authentication
  CAPTURE_AUTH_TOKENS: "CAPTURE_AUTH_TOKENS",
};

/**
 * Sends a message to the background script and awaits a response.
 * Wraps chrome.runtime.sendMessage in a Promise with error handling.
 *
 * @param {Object} msg - Message object with { type, ...payload }
 * @returns {Promise<{ok: boolean, error?: string, [key: string]: any}>}
 *
 * @example
 * const res = await sendMessage({ type: MSG.START_EQ, tabId: 123 });
 * if (res.ok) { ... }
 */
export function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, error: err.message });
      resolve(res ?? { ok: true });
    });
  });
}
