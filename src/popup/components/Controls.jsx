import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { generateBellCurve } from "../../lib/graphs.js";
import { FREQUENCIES } from "../../lib/qCalculations.js";
import { useNodeDrag } from "../hooks/useNodeDrag.js";
import { useSpectrumToggle } from "../hooks/useSpectrumToggle.js";
import {
  SVG_WIDTH,
  SVG_HEIGHT,
  CENTER_Y,
  NODE_RADIUS,
  getBaseXPos,
  getXPosFromFrequency,
} from "../../lib/svgCoordinateSystem.js";

/**
 * Controls Component - Interactive EQ Visualizer
 *
 * Features:
 * - 11 draggable frequency bands (20 Hz - 20.48 kHz)
 * - Real-time bell curve visualization for boost/cut
 * - Real-time spectrum visualizer
 * - Frequency range: 1-21500 Hz
 * - Gain range: -30 to +30 dB
 * - Master volume control on left sidebar
 *
 * Props:
 * - volume: master volume gain (0-1+)
 * - onVolumeStart: handler for volume slider mousedown
 * - nodePositions: { [index]: { x, y } } - draggable node positions
 * - nodeGainValues: { [index]: dB } - gain values from Web Audio API
 * - nodeFrequencyValues: { [index]: Hz } - frequency values from Web Audio API
 * - nodeQValues: { [index]: Q } - Q values from Web Audio API
 * - nodeBaseQValues: { [index]: baseQ } - base Q values for shift-drag
 * - onEqNodesChange: callback(positions, gainValues, freqValues, qValues, baseQValues)
 * - onEnsureBackend: callback to ensure backend is ready before operations
 * - spectrumData: array of frequency bin values (0-255) for real-time spectrum
 */
const Controls = forwardRef(function Controls(
  {
    volume,
    onVolumeStart,
    nodePositions,
    nodeGainValues,
    nodeFrequencyValues,
    nodeQValues,
    nodeBaseQValues,
    onEqNodesChange,
    onEnsureBackend,
    spectrumData = [],
    eqActive = true,
    themes = [],
    themeIndex = 0,
  },
  ref,
) {
  const [hoveredSpectrumBtn, setHoveredSpectrumBtn] = useState(false);
  const svgRef = useRef(null);

  // Get current theme colors
  const COLORS = themes[themeIndex] || {};

  // Standard frequency bands used in audio processing
  const frequencies = FREQUENCIES;

  // Spectrum toggle hook
  const { spectrumEnabled, toggleSpectrum } = useSpectrumToggle();

  // Node drag hook
  const { draggingNode, handleNodeMouseDown } = useNodeDrag({
    svgRef,
    frequencies,
    nodePositions,
    nodeGainValues,
    nodeFrequencyValues,
    nodeQValues,
    nodeBaseQValues,
    onEqNodesChange,
    onEnsureBackend,
  });

  // Expose resetFilters method via ref
  useImperativeHandle(ref, () => ({
    resetFilters() {
      onEqNodesChange({}, {}, {}, {}, {});
      console.log("[Controls] All EQ nodes reset to defaults");
    },
  }));

  /**
   * Get current position of a node including drag offset
   * Constrains node to stay within SVG viewbox (accounting for radius)
   */
  function getNodePosition(index) {
    const baseX = getBaseXPos(index, frequencies);
    const pos = nodePositions[index] || { x: 0, y: 0 };
    const nodeX = baseX + pos.x;
    const nodeY = CENTER_Y + pos.y;

    // Keep entire circle inside viewbox
    const constrainedX = Math.max(3, Math.min(SVG_WIDTH - 3, nodeX));
    const constrainedY = Math.max(3, Math.min(SVG_HEIGHT - 3, nodeY));

    return { x: constrainedX, y: constrainedY };
  }

  /**
   * Convert linear gain value to slider position
   * Maps gain range (-30 to +10 dB) to visual position (0-100%)
   */
  function getSliderPosition(gain) {
    if (gain === 0) return 0;
    const db = 20 * Math.log10(gain);
    const ratio = (db + 30) / 40;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  }

  /**
   * Render spectrum analyzer as a high-resolution line graph
   * Uses all frequency bins for maximum accuracy
   * Maps entire frequency range (5Hz-20480Hz) to full viewbox width and height
   * Inverted Y-axis: magnitude 255 at top (y=0), magnitude 0 at bottom (y=500)
   */
  function renderSpectrumLine() {
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
        stroke={COLORS.TEXT}
        strokeWidth="2"
        fill="none"
        opacity="0.6"
        pointerEvents="none"
      />
    );
  }

  return (
    <div className="flex overflow-hidden">
      {/* ===== LEFT SIDEBAR: VOLUME CONTROL ===== */}
      <aside className="w-12 ml-1 flex flex-col items-center justify-between">
        {/* Spectrum visualizer toggle (rotated text) */}
        <button
          onClick={toggleSpectrum}
          disabled={!eqActive}
          style={{
            borderColor: !eqActive ? `${COLORS.TEXT}80` : COLORS.TEXT,
            backgroundColor:
              spectrumEnabled || hoveredSpectrumBtn
                ? COLORS.TEXT
                : "transparent",
            color:
              spectrumEnabled || hoveredSpectrumBtn
                ? COLORS.BACKGROUND
                : COLORS.TEXT,
            opacity: !eqActive ? 0.5 : 1,
            cursor: !eqActive ? "not-allowed" : "pointer",
          }}
          className="my-6 text-xs -rotate-90 cursor-pointer border px-2 rounded-b-sm rounded-t-xs"
          onMouseEnter={() => !eqActive || setHoveredSpectrumBtn(true)}
          onMouseLeave={() => setHoveredSpectrumBtn(false)}
        >
          Spectrum Visualizer
        </button>

        {/* Master volume slider */}
        <div className="flex flex-col items-center select-none">
          <div className="text-xs mb-2 select-none">volume</div>
          <div
            className="h-60 w-px rounded relative"
            style={{
              backgroundColor: `${COLORS.TEXT}80`,
            }}
            onMouseDown={onVolumeStart}
          >
            <div
              className="absolute w-9 h-1.5 -left-4.25 cursor-pointer"
              style={{
                backgroundColor: COLORS.TEXT,
                bottom: `${getSliderPosition(volume)}%`,
              }}
            />
          </div>
        </div>
      </aside>

      {/* ===== MAIN: EQ VISUALIZATION ===== */}
      <main className="w-[730px] h-[365px] relative">
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full border"
          style={{
            borderColor: `${COLORS.TEXT}80`,
          }}
          viewBox="0 0 1000 500"
          preserveAspectRatio="none"
        >
          {/* SVG Defs for Gradients */}
          <defs>
            {frequencies.map((freq, index) => {
              const isShelf = index === 2 || index === 12;
              const nodeColor = isShelf ? COLORS.SHELF : COLORS.POINT;
              const nodePos = getNodePosition(index);
              const cy = nodePos.y;

              // Gradient transitions from node color at peak (cy) to dark at center (250)
              const y1 = Math.min(cy, CENTER_Y);
              const y2 = Math.max(cy, CENTER_Y);

              return (
                <linearGradient
                  key={`grad-${freq}`}
                  id={`gradient-${index}`}
                  x1="0%"
                  y1={`${y1}`}
                  x2="0%"
                  y2={`${y2}`}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      cy < CENTER_Y ? nodeColor : `${COLORS.BACKGROUND}00`
                    }
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      cy < CENTER_Y ? `${COLORS.BACKGROUND}00` : nodeColor
                    }
                  />
                </linearGradient>
              );
            })}
          </defs>

          {/* SPECTRUM VISUALIZER LINE */}
          {renderSpectrumLine()}

          {/* Y-AXIS: Gain Labels (-25 to +25 dB) */}
          {[25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25].map((label) => {
            // Map dB value to Y coordinate (250 = 0dB center)
            const yPos = CENTER_Y + (-label * (SVG_HEIGHT / 2)) / 30;
            return (
              <g key={`y-${label}`}>
                <line
                  x1="0"
                  y1={yPos}
                  x2="8"
                  y2={yPos}
                  stroke={COLORS.TEXT}
                  strokeWidth="1"
                />
                <text
                  x="12"
                  y={yPos + 4}
                  fontSize="18"
                  fill={COLORS.TEXT}
                  textAnchor="start"
                  className="select-none"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* X-AXIS: Frequency Bands with EQ Nodes */}
          {frequencies.map((freq, index) => {
            const xPos = getBaseXPos(index, frequencies);
            const nodePos = getNodePosition(index);
            const bellCurvePath = generateBellCurve(
              index,
              nodePositions,
              nodeBaseQValues,
              frequencies,
            );

            // Determine node type: shelf (index 2, 12) or mid-range EQ (index 3-11)
            const isShelf = index === 2 || index === 12;
            const isNode = index >= 2 && index <= 12;

            return (
              <g key={`band-${freq}`}>
                {/* Frequency band tick marks */}
                <line
                  x1={xPos}
                  y1="475"
                  x2={xPos}
                  y2="500"
                  stroke={COLORS.TEXT}
                  strokeWidth="1"
                  pointerEvents="none"
                />
                <line
                  x1={xPos}
                  y1="0"
                  x2={xPos}
                  y2="25"
                  stroke={COLORS.TEXT}
                  strokeWidth="1"
                  pointerEvents="none"
                />

                {/* Center reference line (0 dB baseline) */}
                <line
                  x1={xPos}
                  y1="235"
                  x2={xPos}
                  y2="265"
                  stroke={`${COLORS.TEXT}80`}
                  strokeWidth="1"
                />

                {/* Frequency label */}
                <text
                  x={xPos}
                  y="470"
                  fontSize="18"
                  fill={COLORS.TEXT}
                  textAnchor="middle"
                  className="select-none"
                  pointerEvents="none"
                >
                  {freq}
                </text>

                {/* Bell curve visualization */}
                {bellCurvePath && (
                  <path
                    d={bellCurvePath.path}
                    stroke={`url(#gradient-${index})`}
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    pointerEvents="none"
                  />
                )}

                {/* Draggable EQ Node Circle */}
                {isNode && (
                  <circle
                    cx={nodePos.x}
                    cy={nodePos.y}
                    r={NODE_RADIUS}
                    fill={
                      draggingNode === index
                        ? COLORS.BACKGROUND
                        : isShelf
                          ? COLORS.SHELF
                          : COLORS.POINT
                    }
                    stroke={
                      draggingNode === index
                        ? "rgb(255 195 0)"
                        : isShelf
                          ? COLORS.SHELF
                          : COLORS.POINT
                    }
                    strokeWidth={draggingNode === index ? "2" : "1"}
                    className="cursor-pointer"
                    onMouseDown={(e) => handleNodeMouseDown(index, e)}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </main>
    </div>
  );
});

export default Controls;
