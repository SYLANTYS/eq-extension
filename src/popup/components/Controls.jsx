import { useRef, useImperativeHandle, forwardRef } from "react";
import { generateBellCurve } from "../../lib/controls/graphs.js";
import { FREQUENCIES } from "../../lib/qCalculations.js";
import { useNodeDrag } from "../hooks/controls/useNodeDrag.js";
import { useSpectrumToggle } from "../hooks/controls/useSpectrumToggle.js";
import SpectrumLine from "./controls/SpectrumLine.jsx";
import VolumeSlider from "./controls/VolumeSlider.jsx";
import SpectrumToggleButton from "./controls/SpectrumToggleButton.jsx";
import EqGradientDefs from "./controls/EqGradientDefs.jsx";
import {
  SVG_WIDTH,
  SVG_HEIGHT,
  CENTER_Y,
  NODE_RADIUS,
  getBaseXPos,
  getNodePosition as getNodePositionBase,
} from "../../lib/controls/svgCoordinateSystem.js";

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
  /**
   * Get current position of a node including drag offset.
   * Wrapper around shared function with component's nodePositions.
   */
  function getNodePosition(index) {
    return getNodePositionBase(index, nodePositions, frequencies);
  }

  return (
    <div className="flex overflow-hidden">
      {/* ===== LEFT SIDEBAR: VOLUME CONTROL ===== */}
      <aside className="w-12 ml-1 flex flex-col items-center justify-between">
        {/* Spectrum visualizer toggle (rotated text) */}
        <SpectrumToggleButton
          enabled={spectrumEnabled}
          onToggle={toggleSpectrum}
          eqActive={eqActive}
          colors={COLORS}
        />

        {/* Master volume slider */}
        <VolumeSlider
          volume={volume}
          onVolumeStart={onVolumeStart}
          colors={COLORS}
        />
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
          <EqGradientDefs
            frequencies={frequencies}
            getNodePosition={getNodePosition}
            colors={COLORS}
          />

          {/* SPECTRUM VISUALIZER LINE */}
          <SpectrumLine
            spectrumData={spectrumData}
            frequencies={frequencies}
            eqActive={eqActive}
            spectrumEnabled={spectrumEnabled}
            color={COLORS.TEXT}
          />

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
