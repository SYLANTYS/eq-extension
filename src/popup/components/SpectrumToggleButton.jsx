// src/popup/components/SpectrumToggleButton.jsx
// Rotated toggle button for spectrum visualizer.

import { useState } from "react";

/**
 * SpectrumToggleButton Component - Toggle for spectrum visualizer
 *
 * @param {Object} props
 * @param {boolean} props.enabled - Whether spectrum is currently enabled
 * @param {Function} props.onToggle - Handler for toggle click
 * @param {boolean} props.eqActive - Whether EQ is active (button disabled when false)
 * @param {Object} props.colors - Theme colors { TEXT, BACKGROUND }
 */
export default function SpectrumToggleButton({
  enabled,
  onToggle,
  eqActive,
  colors,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      disabled={!eqActive}
      style={{
        borderColor: !eqActive ? `${colors.TEXT}80` : colors.TEXT,
        backgroundColor:
          enabled || hovered ? colors.TEXT : "transparent",
        color:
          enabled || hovered ? colors.BACKGROUND : colors.TEXT,
        opacity: !eqActive ? 0.5 : 1,
        cursor: !eqActive ? "not-allowed" : "pointer",
      }}
      className="my-6 text-xs -rotate-90 cursor-pointer border px-2 rounded-b-sm rounded-t-xs"
      onMouseEnter={() => eqActive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Spectrum Visualizer
    </button>
  );
}
