// src/popup/components/EqGradientDefs.jsx
// SVG gradient definitions for EQ bell curves.

import { CENTER_Y } from "../../lib/svgCoordinateSystem.js";

/**
 * EqGradientDefs Component - SVG gradient definitions for bell curves
 *
 * Creates linear gradients that transition from node color at peak
 * to transparent at the 0dB center line.
 *
 * @param {Object} props
 * @param {number[]} props.frequencies - Frequency band array
 * @param {Function} props.getNodePosition - Function to get node position by index
 * @param {Object} props.colors - Theme colors { SHELF, POINT, BACKGROUND }
 */
export default function EqGradientDefs({ frequencies, getNodePosition, colors }) {
  return (
    <defs>
      {frequencies.map((freq, index) => {
        const isShelf = index === 2 || index === 12;
        const nodeColor = isShelf ? colors.SHELF : colors.POINT;
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
                cy < CENTER_Y ? nodeColor : `${colors.BACKGROUND}00`
              }
            />
            <stop
              offset="100%"
              stopColor={
                cy < CENTER_Y ? `${colors.BACKGROUND}00` : nodeColor
              }
            />
          </linearGradient>
        );
      })}
    </defs>
  );
}
