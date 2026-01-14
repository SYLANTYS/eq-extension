/**
 * Generate SVG path for true parametric EQ filter response
 * Uses RBJ Audio EQ Cookbook formulas for both peaking (mid-range) and shelf (low/high) filters
 * Sample rate: 44,100 Hz
 * Frequency range: 1–21500 Hz (log scale)
 * Converts magnitude to dB and maps to SVG Y-axis
 *
 * Filter types:
 * - Index 2: Lowshelf (20 Hz)
 * - Index 3-11: Peaking (mid-range EQ)
 * - Index 12: Highshelf (20.48 kHz)
 */
export function generateBellCurve(
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
  getFrequencyFromXPos
) {
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

  // Compute amplitude and Q
  const A = Math.pow(10, gainDb / 40);
  const isShelf = index === 2 || index === 12;

  // Peaking filters: baseQ default 0.3, standard gain relationship
  const baseQ = nodeBaseQValues[index] ?? (isShelf ? 0.75 : 0.3);

  // Dynamic Q calculation varies by filter type:
  // Peaking: As gain deviates from 0 to ±30, Q scales from 150% to 50% of baseQ
  //   At 0 dB: Q = 1.5 × baseQ, At ±30 dB: Q = 0.5 × baseQ
  const Q = isShelf ? baseQ : baseQ * (1.5 - Math.abs(gainDb) / 30);

  // RBJ filter coefficients (from Audio EQ Cookbook)
  const w0 = (2 * Math.PI * centerFreq) / sampleRate;
  const sinW0 = Math.sin(w0);
  const cosW0 = Math.cos(w0);
  const alpha = sinW0 / (2 * Q);

  // Determine filter type and compute coefficients
  const isLowShelf = index === 2;

  let b0, b1, b2, a0, a1, a2;

  if (isShelf) {
    // RBJ Shelf Filter Coefficients
    if (isLowShelf) {
      // Lowshelf filter (boosts or cuts low frequencies)
      const sqrtA = Math.sqrt(A);
      b0 = A * (A + 1 - (A - 1) * cosW0 + 2 * sqrtA * alpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
      b2 = A * (A + 1 - (A - 1) * cosW0 - 2 * sqrtA * alpha);
      a0 = A + 1 + (A - 1) * cosW0 + 2 * sqrtA * alpha;
      a1 = -2 * (A - 1 + (A + 1) * cosW0);
      a2 = A + 1 + (A - 1) * cosW0 - 2 * sqrtA * alpha;
    } else {
      // Highshelf filter (boosts or cuts high frequencies)
      const sqrtA = Math.sqrt(A);
      b0 = A * (A + 1 + (A - 1) * cosW0 + 2 * sqrtA * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
      b2 = A * (A + 1 + (A - 1) * cosW0 - 2 * sqrtA * alpha);
      a0 = A + 1 - (A - 1) * cosW0 + 2 * sqrtA * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cosW0);
      a2 = A + 1 - (A - 1) * cosW0 - 2 * sqrtA * alpha;
    }
  } else {
    // Peaking EQ filter (mid-range boost/cut)
    b0 = 1 + alpha * A;
    b1 = -2 * cosW0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosW0;
    a2 = 1 - alpha / A;
  }

  // Determine node color (matches circle styling)
  const nodeColor = isShelf ? "rgb(138 104 158)" : "rgb(198 246 221)";

  // Generate 1000 points across log-frequency range (1–21500 Hz) for high precision
  const minFreq = 0.01;
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
