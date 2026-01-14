import { useState, useEffect, useRef } from "react";

/**
 * Controls Component - Interactive EQ Visualizer
 *
 * Features:
 * - 11 draggable frequency bands (20 Hz - 20.48 kHz)
 * - Real-time bell curve visualization for boost/cut
 * - Frequency range: 1-21500 Hz
 * - Gain range: -30 to +30 dB
 * - Master volume control on left sidebar
 */
export default function Controls({ volume, onVolumeStart }) {
  const [nodePositions, setNodePositions] = useState({}); // { [index]: { x, y } }
  const [nodeQValues, setNodeQValues] = useState({}); // { [index]: Q value }
  const [draggingNode, setDraggingNode] = useState(null);
  const [isShiftDrag, setIsShiftDrag] = useState(false);
  const svgRef = useRef(null);
  const shiftDragStartYRef = useRef(null); // Track initial Y position for shift drag

  // Throttle tracking for ensuring backend is ready (1 second cooldown)
  const lastEnsureTimeRef = useRef(0);

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
          resolve(err ? { ok: false } : res ?? { ok: true });
        });
      });

      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "REINIT_MISSING_AUDIO" }, (res) => {
          const err = chrome.runtime.lastError;
          resolve(err ? { ok: false } : res ?? { ok: true });
        });
      });
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
   * Generate SVG path for true parametric EQ bell curve (RBJ biquad peaking filter)
   * Computes frequency-domain magnitude response using RBJ Audio EQ Cookbook formulas
   * Sample rate: 44,100 Hz
   * Frequency range: 1–21500 Hz (log scale)
   * Converts magnitude to dB and maps to SVG Y-axis
   */
  function generateBellCurve(index) {
    const pos = getNodePosition(index);
    const { x: cx, y: cy } = pos;

    // No curve when within ±5 pixels of center (250)
    if (Math.abs(cy - CENTER_Y) <= 5) return null;

    const sampleRate = 44100;
    const gainOffset = cy - CENTER_Y;

    // Derive gain (dB) from Y position
    // Y range: 0-500, Center: 250 (0dB)
    // +30 dB at top, -30 dB at bottom
    const gainDb = -(gainOffset / SVG_HEIGHT) * 60;

    // Derive center frequency from X position
    const centerFreq = getFrequencyFromXPos(cx);

    // Compute Q from gain (steeper for larger gains)
    // Standard EQ Q formula: relates to the bandwidth at -3dB
    // For peaking filters, Q ≈ sqrt(gain) / 2 provides reasonable EQ behavior
    const A = Math.pow(10, gainDb / 40);
    const Q = nodeQValues[index] ?? 0.3; // Use stored Q or default to 0.3

    // RBJ peaking filter coefficients (from Audio EQ Cookbook)
    const w0 = (2 * Math.PI * centerFreq) / sampleRate;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * Q);

    // Peaking EQ filter transfer function H(z)
    const b0 = 1 + alpha * A;
    const b1 = -2 * cosW0;
    const b2 = 1 - alpha * A;
    const a0 = 1 + alpha / A;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha / A;

    // Determine node color (matches circle styling)
    const isShelf = index === 2 || index === 12;
    const nodeColor = isShelf ? "rgb(138 104 158)" : "rgb(198 246 221)";

    // Generate 1000 points across log-frequency range (1–21500 Hz) for high precision
    const minFreq = 1;
    const maxFreq = 21500;
    const points = [];
    const numPoints = 1000;

    for (let i = 0; i <= numPoints; i++) {
      // Log-spaced frequency
      const freq = minFreq * Math.pow(maxFreq / minFreq, i / numPoints);

      // Compute frequency-domain magnitude response |H(e^(jω))|
      const w = (2 * Math.PI * freq) / sampleRate;
      const sinW = Math.sin(w);
      const cosW = Math.cos(w);
      const sin2W = Math.sin(2 * w);
      const cos2W = Math.cos(2 * w);

      // Numerator and denominator of transfer function
      const numReal = b0 + b1 * cosW + b2 * cos2W;
      const numImag = b1 * sinW + b2 * sin2W;
      const denReal = a0 + a1 * cosW + a2 * cos2W;
      const denImag = a1 * sinW + a2 * sin2W;

      // Magnitude of complex division
      const numMag = Math.sqrt(numReal * numReal + numImag * numImag);
      const denMag = Math.sqrt(denReal * denReal + denImag * denImag);
      const magnitude = numMag / denMag;

      // Convert to dB: 20·log10(magnitude)
      const magnitudeDb = 20 * Math.log10(Math.max(magnitude, 1e-10));

      // Map frequency to SVG X coordinate (log scale)
      // Allows graph to extend beyond usable width boundaries (follows node position)
      const maxIndex = frequencies.length - 1;
      const logRatio =
        Math.log(freq / frequencies[0]) /
        Math.log(frequencies[maxIndex] / frequencies[0]);
      const freqXPos =
        X_AXIS_START +
        (USABLE_WIDTH * (Math.pow(GEOMETRIC_RATIO, logRatio * maxIndex) - 1)) /
          (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1);

      // Map dB to SVG Y coordinate
      // SVG Y: 250 = 0dB, each 30dB = 250px
      const svgY = CENTER_Y - (magnitudeDb / 30) * (SVG_HEIGHT / 2);

      points.push(`${i === 0 ? "M" : "L"} ${freqXPos} ${svgY}`);
    }

    return { path: points.join(" "), color: nodeColor };
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
      // Shift+drag: Adjust Q value based on vertical movement (0.1 to 2.0)
      // Uses logarithmic scale for symmetric sensitivity
      // Drag down = lower Q (0.1), drag up = higher Q (2.0)

      // Calculate Q using logarithmic scale for symmetric feel
      // Range: 0.1 to 2.0 (center at 0.3)
      const logMin = Math.log(0.1);
      const logMax = Math.log(2.0);
      const logCenter = Math.log(0.3);

      // Increased sensitivity: 1/3 SVG height for full Q range
      // Use fixed starting position to prevent snapping
      const startY = shiftDragStartYRef.current ?? mouseY;
      const qOffsetRatio = (startY - mouseY) / (SVG_HEIGHT / 3);
      let logQ = logCenter + qOffsetRatio * ((logMax - logMin) / 2);
      let Q = Math.exp(logQ);
      Q = Math.max(0.1, Math.min(2.0, Q)); // Clamp to 0.1-2.0

      console.log(`Q: ${Q.toFixed(2)}`);

      setNodeQValues((prev) => ({
        ...prev,
        [draggingNode]: Q,
      }));
    } else {
      // Normal drag: update node position (frequency/gain)
      const baseX = getBaseXPos(draggingNode);
      const offsetX = mouseX - baseX;
      const offsetY = mouseY - CENTER_Y;
      const currentX = baseX + offsetX;

      // Calculate frequency and gain
      let frequency = getFrequencyFromXPos(currentX);
      frequency = Math.max(1, Math.min(21500, frequency)); // Clamp to 1-21500 Hz

      let gaindB = -(offsetY / SVG_HEIGHT) * 60; // Map pixel offset to dB range
      gaindB = Math.max(-30, Math.min(30, gaindB)); // Clamp to -30 to +30 dB

      // Debug output
      console.log(
        `Frequency: ${frequency.toFixed(2)} Hz | Gain: ${gaindB.toFixed(2)} dB`
      );

      // Update node position
      setNodePositions((prev) => ({
        ...prev,
        [draggingNode]: { x: offsetX, y: offsetY },
      }));
    }
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

  return (
    <div className="flex overflow-hidden">
      {/* ===== LEFT SIDEBAR: VOLUME CONTROL ===== */}
      <aside className="w-12 ml-1 flex flex-col items-center justify-between">
        {/* Spectrum visualizer toggle (rotated text) */}
        <button className="my-6 text-xs -rotate-90 cursor-pointer border border-eq-yellow px-2 rounded-b-sm rounded-t-xs hover:text-eq-blue hover:bg-eq-yellow">
          Spectrum Visualizer
        </button>

        {/* Master volume slider */}
        <div className="flex flex-col items-center">
          <div className="text-xs mb-2 select-none">volume</div>
          <div
            className="h-60 w-px bg-eq-yellow/50 rounded relative"
            onMouseDown={onVolumeStart}
          >
            <div
              className="absolute w-9 h-1.5 bg-eq-yellow -left-4.25 cursor-pointer"
              style={{ bottom: `${getSliderPosition(volume)}%` }}
            />
          </div>
        </div>
      </aside>

      {/* ===== MAIN: EQ VISUALIZATION ===== */}
      <main className="w-[730px] h-[365px] relative">
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full border border-eq-yellow/50"
          viewBox="0 0 1000 500"
          preserveAspectRatio="none"
        >
          {/* SVG Defs for Gradients */}
          <defs>
            {frequencies.map((freq, index) => {
              const isShelf = index === 2 || index === 12;
              const nodeColor = isShelf
                ? "rgb(138 104 158)"
                : "rgb(198 246 221)";
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
                    stopColor={cy < CENTER_Y ? nodeColor : "#2c3e5000"}
                  />
                  <stop
                    offset="100%"
                    stopColor={cy < CENTER_Y ? "#2c3e5000" : nodeColor}
                  />
                </linearGradient>
              );
            })}
          </defs>

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
                  stroke="#f5deb3"
                  strokeWidth="1"
                />
                <text
                  x="12"
                  y={yPos + 4}
                  fontSize="18"
                  fill="#f5deb3"
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
            const bellCurvePath = generateBellCurve(index);

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
                  stroke="#f5deb3"
                  strokeWidth="1"
                />
                <line
                  x1={xPos}
                  y1="0"
                  x2={xPos}
                  y2="25"
                  stroke="#f5deb3"
                  strokeWidth="1"
                />

                {/* Center reference line (0 dB baseline) */}
                <line
                  x1={xPos}
                  y1="235"
                  x2={xPos}
                  y2="265"
                  stroke="#f5deb350"
                  strokeWidth="1"
                />

                {/* Frequency label */}
                <text
                  x={xPos}
                  y="470"
                  fontSize="18"
                  fill="#f5deb3"
                  textAnchor="middle"
                  className="select-none"
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
                        ? "#2c3e50"
                        : isShelf
                        ? "rgb(138 104 158)"
                        : "rgb(198 246 221)"
                    }
                    stroke={
                      draggingNode === index
                        ? "rgb(255 195 0)"
                        : isShelf
                        ? "rgb(138 104 158)"
                        : "rgb(198 246 221)"
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
}
