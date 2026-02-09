// src/popup/components/controls/SpectrumLine.jsx
// Renders spectrum analyzer as a high-resolution SVG line graph.

import {
  SVG_HEIGHT,
  getXPosFromFrequency,
} from "../../../lib/controls/svgCoordinateSystem.js";

/**
 * SpectrumLine Component - Real-time spectrum analyzer visualization
 *
 * Uses all frequency bins for maximum accuracy.
 * Maps entire frequency range (5Hz-20480Hz) to full viewbox width and height.
 * Inverted Y-axis: magnitude 255 at top (y=0), magnitude 0 at bottom (y=500).
 *
 * @param {Object} props
 * @param {number[]} props.spectrumData - Array of frequency bin values (0-255)
 * @param {number[]} props.frequencies - Reference frequency array
 * @param {boolean} props.eqActive - Whether EQ is active
 * @param {boolean} props.spectrumEnabled - Whether spectrum visualizer is enabled
 * @param {string} props.color - Stroke color for the line
 */
export default function SpectrumLine({
  spectrumData = [],
  frequencies,
  eqActive,
  spectrumEnabled,
  color,
}) {
  if (
    !eqActive ||
    !spectrumEnabled ||
    !spectrumData ||
    spectrumData.length === 0
  ) {
    return null;
  }

  const binCount = spectrumData.length;
  const points = [];

  // Estimate sample rate and Nyquist frequency
  // Standard Web Audio contexts use 48kHz sample rate
  const sampleRate = 48000;
  const nyquistFrequency = sampleRate / 2; // 24000Hz

  // Generate points for all spectrum bins, mapping to logarithmic frequency scale
  for (let binIdx = 0; binIdx < binCount; binIdx++) {
    // Calculate the actual frequency this bin represents
    const binFrequency = (binIdx / binCount) * nyquistFrequency;

    // Map this frequency to X position using the same log scale as EQ nodes
    // Clamp frequencies to the valid range (10Hz - 20480Hz)
    let clampedFrequency = binFrequency;
    if (binFrequency < 10) {
      clampedFrequency = 10; // Clamp to 10Hz
    } else if (binFrequency > frequencies[frequencies.length - 1]) {
      clampedFrequency = frequencies[frequencies.length - 1]; // Clamp to 20480Hz
    }
    const xPos = getXPosFromFrequency(clampedFrequency, frequencies);

    const magnitude = spectrumData[binIdx] || 0;

    // Use full viewbox height (0-500)
    // Inverted Y: magnitude 255 = top (0), magnitude 0 = bottom (500)
    const y = SVG_HEIGHT - (magnitude / 255) * SVG_HEIGHT;

    // Add all points - clamping ensures they stay within the visible range
    points.push(`${xPos},${y}`);
  }

  return (
    <polyline
      points={points.join(" ")}
      stroke={color}
      strokeWidth="2"
      fill="none"
      opacity="0.6"
      pointerEvents="none"
    />
  );
}
