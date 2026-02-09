// src/lib/controls/svgCoordinateSystem.js
// Shared SVG coordinate system constants and conversion functions.
// Used by Controls.jsx, eqStateUtils.js, and graphs.js.

import { FREQUENCIES } from "../qCalculations.js";

// SVG coordinate system constants
export const SVG_WIDTH = 1000;
export const SVG_HEIGHT = 500;
export const CENTER_Y = 250;
export const NODE_RADIUS = 7;
export const X_AXIS_START = 120; // Left padding for Y-axis labels
export const X_AXIS_END = 15; // Right padding
export const USABLE_WIDTH = SVG_WIDTH - X_AXIS_START - X_AXIS_END;
export const GEOMETRIC_RATIO = 1.2; // Each frequency spacing is 1.2x wider

/**
 * Get the base X position for a node by its index.
 * Uses geometric series scaling (1.2x spacing).
 *
 * @param {number} index - Node index (0-12)
 * @param {number[]} frequencies - Reference frequency array (defaults to FREQUENCIES)
 * @returns {number} X position in SVG coordinates
 */
export function getBaseXPos(index, frequencies = FREQUENCIES) {
  const maxIndex = frequencies.length - 1;
  return (
    X_AXIS_START +
    (USABLE_WIDTH * (Math.pow(GEOMETRIC_RATIO, index) - 1)) /
      (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1)
  );
}

/**
 * Convert X position to frequency using inverse geometric series formula.
 * Ensures frequency values align perfectly with X-axis markings.
 *
 * @param {number} xPos - X position in SVG coordinates
 * @param {number[]} frequencies - Reference frequency array (defaults to FREQUENCIES)
 * @returns {number} Frequency in Hz
 */
export function getFrequencyFromXPos(xPos, frequencies = FREQUENCIES) {
  const minFreq = frequencies[0];
  const maxFreq = frequencies[frequencies.length - 1];
  const maxIndex = frequencies.length - 1;

  // Normalize X position to [0, 1]
  let normalized = (xPos - X_AXIS_START) / USABLE_WIDTH;
  normalized = Math.max(0, Math.min(1, normalized)); // Clamp to avoid NaN

  // Reverse geometric series formula
  const denominator = Math.pow(GEOMETRIC_RATIO, maxIndex) - 1;
  const ratioTerm = normalized * denominator + 1;
  const indexFloat = Math.log(ratioTerm) / Math.log(GEOMETRIC_RATIO);

  // Map to frequency using log scale
  return minFreq * Math.pow(maxFreq / minFreq, indexFloat / maxIndex);
}

/**
 * Convert frequency value to X position on the logarithmic scale.
 * Uses the same geometric series formula as EQ nodes.
 *
 * @param {number} frequency - Frequency in Hz
 * @param {number[]} frequencies - Reference frequency array (defaults to FREQUENCIES)
 * @returns {number} X position in SVG coordinates
 */
export function getXPosFromFrequency(frequency, frequencies = FREQUENCIES) {
  const minFreq = frequencies[0];
  const maxFreq = frequencies[frequencies.length - 1];
  const maxIndex = frequencies.length - 1;

  // Clamp frequency to valid range
  if (frequency < minFreq) frequency = minFreq;
  if (frequency > maxFreq) frequency = maxFreq;

  // Calculate position in log scale
  const logFreqRatio = Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq);
  const indexFloat = logFreqRatio * maxIndex;

  // Map to X position using geometric series
  const xRatio =
    (Math.pow(GEOMETRIC_RATIO, indexFloat) - 1) /
    (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1);
  return X_AXIS_START + xRatio * USABLE_WIDTH;
}

/**
 * Calculate node position offsets from frequency and gain values.
 * Used to convert Web Audio API values to UI node positions.
 *
 * @param {number} index - Node index (0-12)
 * @param {number} frequency - Frequency in Hz
 * @param {number} gainDb - Gain in dB
 * @param {number[]} frequencies - Reference frequency array (defaults to FREQUENCIES)
 * @returns {{ x: number, y: number }} Position offset from base position
 */
export function calculatePositionOffset(index, frequency, gainDb, frequencies = FREQUENCIES) {
  const baseX = getBaseXPos(index, frequencies);
  const currentX = getXPosFromFrequency(frequency, frequencies);
  const offsetX = currentX - baseX;
  const offsetY = -(gainDb / 60) * SVG_HEIGHT;
  return { x: offsetX, y: offsetY };
}

/**
 * Get current position of a node including drag offset.
 * Constrains node to stay within SVG viewbox (accounting for radius).
 *
 * @param {number} index - Node index (0-12)
 * @param {Object} nodePositions - Node positions { [index]: { x, y } }
 * @param {number[]} frequencies - Reference frequency array (defaults to FREQUENCIES)
 * @returns {{ x: number, y: number }} Constrained node position in SVG coordinates
 */
export function getNodePosition(index, nodePositions, frequencies = FREQUENCIES) {
  const baseX = getBaseXPos(index, frequencies);
  const pos = nodePositions[index] || { x: 0, y: 0 };
  const nodeX = baseX + pos.x;
  const nodeY = CENTER_Y + pos.y;

  // Keep entire circle inside viewbox
  const constrainedX = Math.max(3, Math.min(SVG_WIDTH - 3, nodeX));
  const constrainedY = Math.max(3, Math.min(SVG_HEIGHT - 3, nodeY));

  return { x: constrainedX, y: constrainedY };
}
