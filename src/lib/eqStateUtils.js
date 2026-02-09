// src/lib/eqStateUtils.js
// Utilities for EQ state persistence and management.
// Handles localStorage, position calculations, and EQ value defaults.

import {
  DEFAULT_PEAKING_Q,
  DEFAULT_SHELF_Q,
  baseQToQ,
  FREQUENCIES,
} from "./qCalculations.js";
import { sendMessage, MSG } from "./chromeMessaging.js";
import {
  SVG_HEIGHT,
  getBaseXPos,
  getXPosFromFrequency,
  calculatePositionOffset,
} from "./svgCoordinateSystem.js";

// localStorage key for current EQ state
const EQ_STATE_KEY = "eqCurrentState";

/**
 * Save current EQ node state to localStorage.
 * Used for persistence after offscreen restarts.
 *
 * @param {Object} positions - Node UI positions { [index]: { x, y } }
 * @param {Object} gains - Gain values in dB { [index]: number }
 * @param {Object} freqs - Frequency values in Hz { [index]: number }
 * @param {Object} qs - Q factor values { [index]: number }
 * @param {Object} baseQs - Base Q values before gain adjustment { [index]: number }
 */
export function saveEqStateToLocalStorage(positions, gains, freqs, qs, baseQs) {
  const eqState = {
    nodePositions: positions,
    nodeGainValues: gains,
    nodeFrequencyValues: freqs,
    nodeQValues: qs,
    nodeBaseQValues: baseQs,
    timestamp: Date.now(),
  };
  localStorage.setItem(EQ_STATE_KEY, JSON.stringify(eqState));
  console.log("[eqStateUtils] EQ state saved to localStorage");
}

/**
 * Load EQ node state from localStorage.
 * Returns null if no saved state exists.
 *
 * @returns {Object|null} Saved EQ state or null
 */
export function loadEqStateFromLocalStorage() {
  try {
    const stored = localStorage.getItem(EQ_STATE_KEY);
    if (stored) {
      const eqState = JSON.parse(stored);
      console.log("[eqStateUtils] EQ state loaded from localStorage");
      return eqState;
    }
  } catch (e) {
    console.warn(
      "[eqStateUtils] Failed to load EQ state from localStorage:",
      e,
    );
  }
  return null;
}

/**
 * Clear saved EQ state from localStorage.
 */
export function clearEqStateFromLocalStorage() {
  localStorage.removeItem(EQ_STATE_KEY);
  console.log("[eqStateUtils] EQ state cleared from localStorage");
}

/**
 * Build complete EQ value objects with all indexes (defaults + overrides).
 * Ensures all 13 frequency bands have values, filling in defaults where needed.
 *
 * @param {Object} overrideGainValues - Gain overrides { [index]: dB }
 * @param {Object} overrideFreqValues - Frequency overrides { [index]: Hz }
 * @param {Object} overrideBaseQValues - BaseQ overrides { [index]: Q }
 * @returns {Object} Complete EQ values with all indexes populated
 */
export function buildCompleteEqValues(
  overrideGainValues = {},
  overrideFreqValues = {},
  overrideBaseQValues = {},
) {
  const completeGainValues = {};
  const completeFreqValues = {};
  const completeBaseQValues = {};
  const completeQValues = {};

  // Set all indexes to defaults first
  for (let i = 0; i < FREQUENCIES.length; i++) {
    completeGainValues[i] = 0; // 0 dB default
    completeFreqValues[i] = FREQUENCIES[i];
    // Default baseQ values: shelf Q for shelves, peaking Q for mid-range
    completeBaseQValues[i] =
      i === 2 || i === 12 ? DEFAULT_SHELF_Q : DEFAULT_PEAKING_Q;
  }

  // Override with provided values
  Object.assign(completeGainValues, overrideGainValues);
  Object.assign(completeFreqValues, overrideFreqValues);
  Object.assign(completeBaseQValues, overrideBaseQValues);

  // Calculate Q values from baseQ and gain
  for (let i = 0; i < FREQUENCIES.length; i++) {
    const baseQ = completeBaseQValues[i];
    const gain = completeGainValues[i];
    completeQValues[i] = baseQToQ(i, baseQ, gain);
  }

  return {
    completeGainValues,
    completeFreqValues,
    completeQValues,
    completeBaseQValues,
  };
}

/**
 * Convert Web Audio API values to UI node positions.
 * Used during initialization to populate node positions from EQ state.
 *
 * @param {Object} nodeFrequencyValues - Frequency values { [index]: Hz }
 * @param {Object} nodeGainValues - Gain values { [index]: dB }
 * @param {number[]} frequencies - Reference frequency array (FREQUENCIES)
 * @returns {Object} Node positions { [index]: { x, y } }
 */
export function calculateNodePositions(
  nodeFrequencyValues,
  nodeGainValues,
  frequencies = FREQUENCIES,
) {
  const positions = {};

  for (const indexStr in nodeFrequencyValues) {
    const index = parseInt(indexStr, 10);
    const freq = nodeFrequencyValues[index];
    const gainDb = nodeGainValues[index] ?? 0;

    positions[index] = calculatePositionOffset(index, freq, gainDb, frequencies);
  }

  return positions;
}

/**
 * Apply EQ state: save to localStorage AND sync to Web Audio API.
 * Combines two common operations into one atomic action.
 *
 * @param {number} tabId - Chrome tab ID
 * @param {Object} gainValues - Gain values { [index]: dB }
 * @param {Object} freqValues - Frequency values { [index]: Hz }
 * @param {Object} qValues - Q values { [index]: Q }
 * @param {Object} baseQValues - BaseQ values { [index]: baseQ }
 * @param {Object} positions - Optional node positions (calculated if not provided)
 * @returns {Promise<{ok: boolean}>} Result of Web Audio sync
 */
export async function applyEqState(
  tabId,
  gainValues,
  freqValues,
  qValues,
  baseQValues,
  positions = null,
) {
  // Calculate positions if not provided
  const nodePositions =
    positions ?? calculateNodePositions(freqValues, gainValues);

  // Save to localStorage for persistence
  saveEqStateToLocalStorage(
    nodePositions,
    gainValues,
    freqValues,
    qValues,
    baseQValues,
  );

  // Sync to Web Audio API if we have a tab ID
  if (tabId) {
    return await sendMessage({
      type: MSG.UPDATE_EQ_NODES,
      tabId,
      nodeGainValues: gainValues,
      nodeFrequencyValues: freqValues,
      nodeQValues: qValues,
    });
  }

  return { ok: true };
}

/**
 * Get default EQ values (all filters at 0 dB, default frequencies and Q).
 * Used when resetting EQ to defaults.
 *
 * @returns {Object} Default EQ values
 */
export function getDefaultEqValues() {
  return buildCompleteEqValues({}, {}, {});
}
