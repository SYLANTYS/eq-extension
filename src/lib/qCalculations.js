/**
 * Unified Q-factor calculations for EQ system
 * Used across UI (Controls, Popup), visualization (graphs.js), and Web Audio API (offscreen.js)
 * Ensures consistent Q value derivation throughout the entire audio pipeline
 */

// Q-factor configuration constants (shared across all modules)
export const Q_MULTIPLIER = 2.0; // Multiplier for gain-dependent Q calculation
export const DEFAULT_PEAKING_Q = 0.3; // Default Q for peaking filters (mid-range)
export const DEFAULT_SHELF_Q = 0.75; // Default Q for shelf filters (low/high)

/**
 * Standard frequency bands used in audio processing
 * Used across all EQ components (Controls, Popup, offscreen, graphs)
 * 13 bands total: 2 inactive (indices 0-1) + 11 interactive (indices 2-12)
 */
export const FREQUENCIES = [
  5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
];

/**
 * Determine if a filter is a shelf filter based on its index
 * Index 2: Low shelf (20 Hz)
 * Index 12: High shelf (20.48 kHz)
 * Index 3-11: Peaking (mid-range)
 */
export function isShelfFilter(index) {
  return index === 2 || index === 12;
}

/**
 * Get default Q value for a filter based on type
 */
export function getDefaultQ(index) {
  return isShelfFilter(index) ? DEFAULT_SHELF_Q : DEFAULT_PEAKING_Q;
}

/**
 * Convert baseQ to Q value
 * For shelf filters: Q = baseQ (unchanged)
 * For peaking filters: Q = baseQ * 2^(1 - 2*|gain|/30)
 *   At 0 dB: Q = baseQ * 2.0
 *   At ±30 dB: Q = baseQ / 2.0
 *
 * @param {number} index - Filter index (0-12)
 * @param {number} baseQ - Base Q value (user-settable via shift-drag)
 * @param {number} gainDb - Gain in dB (-30 to +30)
 * @returns {number} Calculated Q value for this gain level
 */
export function baseQToQ(index, baseQ, gainDb) {
  if (isShelfFilter(index)) {
    return baseQ; // For shelves, Q and baseQ are the same
  }
  // For peaking: Q = baseQ * Q_MULTIPLIER^(1 - 2*|gain|/30)
  return baseQ * Math.pow(Q_MULTIPLIER, 1 - (2 * Math.abs(gainDb)) / 30);
}

/**
 * Convert Q back to baseQ
 * Reverse of baseQToQ formula
 * For shelf filters: baseQ = Q
 * For peaking filters: baseQ = Q / 2^(1 - 2*|gain|/30)
 *
 * @param {number} index - Filter index (0-12)
 * @param {number} q - Current Q value from Web Audio API
 * @param {number} gainDb - Current gain in dB
 * @returns {number} Original baseQ value
 */
export function qToBaseQ(index, q, gainDb) {
  if (isShelfFilter(index)) {
    return q; // For shelves, Q and baseQ are the same
  }
  const divisor = Math.pow(Q_MULTIPLIER, 1 - (2 * Math.abs(gainDb)) / 30);
  return divisor !== 0 ? q / divisor : DEFAULT_PEAKING_Q; // Fallback to default
}

/**
 * Calculate Q value from baseQ and gain
 * This is the primary function used throughout the app
 * Combines isShelfFilter check with baseQToQ calculation
 *
 * @param {number} index - Filter index (0-12)
 * @param {number} baseQ - Base Q value
 * @param {number} gainDb - Gain in dB
 * @returns {number} Calculated Q value
 */
export function calculateQ(index, baseQ, gainDb) {
  return baseQToQ(index, baseQ, gainDb);
}
