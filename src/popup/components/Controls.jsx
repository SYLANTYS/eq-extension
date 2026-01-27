import {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { generateBellCurve } from "./graphs";

// Q-factor configuration constants (must match Popup.jsx)
const Q_MULTIPLIER = 1.5; // Multiplier for gain-dependent Q calculation
const DEFAULT_PEAKING_Q = 0.3; // Default Q for peaking filters
const DEFAULT_SHELF_Q = 0.75; // Default Q for shelf filters

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
    spectrumData = [],
    eqActive = true,
    themes = [],
    themeIndex = 0,
  },
  ref,
) {
  const [draggingNode, setDraggingNode] = useState(null);
  const [isShiftDrag, setIsShiftDrag] = useState(false);
  const [spectrumEnabled, setSpectrumEnabledState] = useState(false);
  const [hoveredSpectrumBtn, setHoveredSpectrumBtn] = useState(false);
  const svgRef = useRef(null);
  const shiftDragStartYRef = useRef(null); // Track initial Y position for shift drag

  // Get current theme colors
  const COLORS = themes[themeIndex] || {};

  // Throttle tracking for ensuring backend is ready (1 second cooldown)
  const lastEnsureTimeRef = useRef(0);

  // Load spectrum enabled state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("spectrumVisualizerEnabled");
    if (stored !== null) {
      setSpectrumEnabledState(JSON.parse(stored));
    }
  }, []);

  // Save spectrum enabled state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(
      "spectrumVisualizerEnabled",
      JSON.stringify(spectrumEnabled),
    );
  }, [spectrumEnabled]);

  // Wrapper to update state and trigger localStorage save
  function setSpectrumEnabled(value) {
    setSpectrumEnabledState(value);
  }

  // Expose resetFilters method via ref
  useImperativeHandle(ref, () => ({
    resetFilters() {
      onEqNodesChange({}, {}, {}, {}, {});
      console.log("[Controls] All EQ nodes reset to defaults");
    },
  }));

  // Throttled ensure backend ready with 1 second cooldown
  async function throttledEnsureBackend() {
    const now = Date.now();
    if (now - lastEnsureTimeRef.current < 1000) {
      return; // Skip if called within last 1 second
    }
    lastEnsureTimeRef.current = now;

    // Call backend ping and reinit via sendMessage
    try {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "PING_BG" }, (res) => {
          const err = chrome.runtime.lastError;
          resolve(err ? { ok: false } : (res ?? { ok: true }));
        });
      });

      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "REINIT_MISSING_AUDIO" }, (res) => {
          const err = chrome.runtime.lastError;
          resolve(err ? { ok: false } : (res ?? { ok: true }));
        });
      });

      // Rehydrate Web Audio API with current UI state
      if (Object.keys(nodeGainValues).length > 0) {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "UPDATE_EQ_NODES",
              nodeGainValues,
              nodeFrequencyValues,
              nodeQValues,
            },
            (res) => {
              const err = chrome.runtime.lastError;
              resolve(err ? { ok: false } : (res ?? { ok: true }));
            },
          );
        });
      }
    } catch (e) {
      console.warn("[Controls] Error ensuring backend:", e);
    }
  }

  // Standard frequency bands used in audio processing
  const frequencies = [
    5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
  ];

  // SVG Coordinate System:
  // - Horizontal (X): 0-1000 units, 1Hz-21500Hz on log scale
  // - Vertical (Y): 0-500 units, 0dB at center (250), -30dB at bottom, +30dB at top
  // - Node radius: 7 units
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 500;
  const CENTER_Y = 250;
  const NODE_RADIUS = 7;

  const X_AXIS_START = 120; // Left padding for Y-axis labels
  const X_AXIS_END = 15; // Right padding
  const USABLE_WIDTH = SVG_WIDTH - X_AXIS_START - X_AXIS_END;
  const GEOMETRIC_RATIO = 1.2; // Each frequency spacing is 1.2x wider

  /**
   * Get the base X position for a node by its index
   * Uses geometric series scaling (1.2x spacing)
   */
  function getBaseXPos(index) {
    const maxIndex = frequencies.length - 1;
    return (
      X_AXIS_START +
      (USABLE_WIDTH * (Math.pow(GEOMETRIC_RATIO, index) - 1)) /
        (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1)
    );
  }

  /**
   * Get current position of a node including drag offset
   * Constrains node to stay within SVG viewbox (accounting for radius)
   */
  function getNodePosition(index) {
    const baseX = getBaseXPos(index);
    const pos = nodePositions[index] || { x: 0, y: 0 };
    const nodeX = baseX + pos.x;
    const nodeY = CENTER_Y + pos.y;

    // Keep entire circle inside viewbox
    const constrainedX = Math.max(3, Math.min(SVG_WIDTH - 3, nodeX));
    const constrainedY = Math.max(3, Math.min(SVG_HEIGHT - 3, nodeY));

    return { x: constrainedX, y: constrainedY };
  }

  /**
   * Initiate node drag
   */
  function handleNodeMouseDown(index, e) {
    e.preventDefault();
    throttledEnsureBackend();
    setDraggingNode(index);
    setIsShiftDrag(e.shiftKey);
    if (e.shiftKey) {
      // For shift drag, capture starting Y position
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const svgRect = svg.viewBox.baseVal;
        const scaleY = svgRect.height / rect.height;
        const mouseY = (e.clientY - rect.top) * scaleY;
        shiftDragStartYRef.current = mouseY;
      }
    }
  }

  /**
   * Convert X position to frequency using inverse geometric series formula
   * Ensures frequency values align perfectly with X-axis markings
   */
  function getFrequencyFromXPos(xPos) {
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
   * Handle mouse move during drag
   * Normal drag: updates node position (frequency/gain)
   * Shift+drag (vertical only): adjusts Q value from 0.1 to 2.0
   * Runs at document level to allow dragging outside SVG
   */
  function handleMouseMove(e) {
    if (draggingNode === null) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const svgRect = svg.viewBox.baseVal;

    // Convert screen coordinates to SVG viewBox coordinates
    const scaleX = svgRect.width / rect.width;
    const scaleY = svgRect.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (isShiftDrag) {
      // Shift+drag: Adjust base Q value based on vertical movement (0.1 to 2.0)
      const logMin = Math.log(0.1);
      const logMax = Math.log(2.0);
      const logCenter = Math.log(DEFAULT_PEAKING_Q);

      const startY = shiftDragStartYRef.current ?? mouseY;
      const qOffsetRatio = (startY - mouseY) / (SVG_HEIGHT / 3);
      let logQ = logCenter + qOffsetRatio * ((logMax - logMin) / 2);
      let baseQ = Math.exp(logQ);
      baseQ = Math.max(0.1, Math.min(2.0, baseQ));

      // console.log(`[Node ${draggingNode}] Base Q: ${baseQ.toFixed(2)}`);

      // Calculate the new Q value from baseQ and current gain
      const isShelf = draggingNode === 2 || draggingNode === 12;
      const gaindB = nodeGainValues[draggingNode] ?? 0;
      const Q = isShelf
        ? baseQ
        : baseQ * (Q_MULTIPLIER - Math.abs(gaindB) / 30);

      // Update parent state via callback with both baseQ and new Q value
      const newBaseQValues = {
        ...nodeBaseQValues,
        [draggingNode]: baseQ,
      };
      const newQValues = {
        ...nodeQValues,
        [draggingNode]: Q,
      };
      onEqNodesChange(
        nodePositions,
        nodeGainValues,
        nodeFrequencyValues,
        newQValues,
        newBaseQValues,
      );
      return;
    }

    // Normal drag: update node position (frequency/gain)
    const baseX = getBaseXPos(draggingNode);
    const offsetX = mouseX - baseX;
    const offsetY = mouseY - CENTER_Y;
    const currentX = baseX + offsetX;

    // Calculate frequency and gain
    let frequency = getFrequencyFromXPos(currentX);
    frequency = Math.max(1, Math.min(21500, frequency));

    let gaindB = -(offsetY / SVG_HEIGHT) * 60;
    gaindB = Math.max(-30, Math.min(30, gaindB));

    const isShelf = draggingNode === 2 || draggingNode === 12;
    const baseQ =
      nodeBaseQValues[draggingNode] ??
      (isShelf ? DEFAULT_SHELF_Q : DEFAULT_PEAKING_Q);
    const Q = isShelf ? baseQ : baseQ * (Q_MULTIPLIER - Math.abs(gaindB) / 30);

    // Update parent state via callback
    const newPositions = {
      ...nodePositions,
      [draggingNode]: { x: offsetX, y: offsetY },
    };
    const newGainValues = {
      ...nodeGainValues,
      [draggingNode]: gaindB,
    };
    const newFrequencyValues = {
      ...nodeFrequencyValues,
      [draggingNode]: frequency,
    };
    const newQValues = {
      ...nodeQValues,
      [draggingNode]: Q,
    };

    onEqNodesChange(
      newPositions,
      newGainValues,
      newFrequencyValues,
      newQValues,
      nodeBaseQValues,
    );

    // Debug output with stored state values
    // const filterType = isShelf ? "Shelf" : "Peaking";
    // console.log(
    //   `[Node ${draggingNode}] ${filterType} → Freq: ${frequency.toFixed(
    //     2
    //   )} Hz | Gain: ${gaindB.toFixed(2)} dB | Base Q: ${baseQ.toFixed(
    //     2
    //   )} | Q: ${Q.toFixed(2)}`
    // );
  }

  /**
   * End drag operation
   */
  function handleMouseUp() {
    setDraggingNode(null);
    setIsShiftDrag(false);
    shiftDragStartYRef.current = null;
  }

  /**
   * Attach document-level mouse listeners when dragging
   * Allows dragging to continue outside SVG boundaries
   */
  useEffect(() => {
    if (draggingNode === null) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNode]);

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
   * Convert frequency value to X position on the logarithmic scale
   * Uses the same geometric series formula as EQ nodes
   */
  function getXPosFromFrequency(frequency) {
    const minFreq = frequencies[0]; // 5Hz
    const maxFreq = frequencies[frequencies.length - 1]; // 20480Hz
    const maxIndex = frequencies.length - 1;

    // Clamp frequency to valid range
    if (frequency < minFreq) frequency = minFreq;
    if (frequency > maxFreq) frequency = maxFreq;

    // Calculate position in log scale
    const logFreqRatio =
      Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq);
    const indexFloat = logFreqRatio * maxIndex;

    // Map to X position using geometric series
    const xRatio =
      (Math.pow(GEOMETRIC_RATIO, indexFloat) - 1) /
      (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1);
    return X_AXIS_START + xRatio * USABLE_WIDTH;
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
      const xPos = getXPosFromFrequency(clampedFrequency);

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
          onClick={() => setSpectrumEnabled(!spectrumEnabled)}
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
        <div className="flex flex-col items-center">
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
            const xPos = getBaseXPos(index);
            const nodePos = getNodePosition(index);
            const bellCurvePath = generateBellCurve(
              index,
              nodePositions,
              nodeBaseQValues,
              frequencies,
              SVG_WIDTH,
              SVG_HEIGHT,
              CENTER_Y,
              X_AXIS_START,
              X_AXIS_END,
              USABLE_WIDTH,
              GEOMETRIC_RATIO,
              getBaseXPos,
              getNodePosition,
              getFrequencyFromXPos,
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
