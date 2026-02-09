// src/popup/components/controls/VolumeSlider.jsx
// Vertical volume slider component with dB-scaled position.

/**
 * Convert linear gain value to slider position.
 * Maps gain range (-30 to +10 dB) to visual position (0-100%).
 *
 * @param {number} gain - Linear gain value (0-1+)
 * @returns {number} Slider position as percentage (0-100)
 */
function getSliderPosition(gain) {
  if (gain === 0) return 0;
  const db = 20 * Math.log10(gain);
  const ratio = (db + 30) / 40;
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

/**
 * VolumeSlider Component - Vertical volume control
 *
 * @param {Object} props
 * @param {number} props.volume - Current volume (linear gain 0-1+)
 * @param {Function} props.onVolumeStart - Handler for mousedown to start drag
 * @param {Object} props.colors - Theme colors { TEXT }
 */
export default function VolumeSlider({ volume, onVolumeStart, colors }) {
  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-xs mb-2 select-none">volume</div>
      <div
        className="h-60 w-px rounded relative"
        style={{
          backgroundColor: `${colors.TEXT}80`,
        }}
        onMouseDown={onVolumeStart}
      >
        <div
          className="absolute w-9 h-1.5 -left-4.25 cursor-pointer"
          style={{
            backgroundColor: colors.TEXT,
            bottom: `${getSliderPosition(volume)}%`,
          }}
        />
      </div>
    </div>
  );
}
