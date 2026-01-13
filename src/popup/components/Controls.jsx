export default function Controls({ volume, onVolumeStart }) {
  // Converts gain to slider visual position (0-100%)
  function getSliderPosition(gain) {
    if (gain === 0) return 0;
    const db = 20 * Math.log10(gain);
    const ratio = (db + 30) / 40;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  }

  return (
    <div className="flex overflow-hidden">
      <aside className="w-12 ml-1 flex flex-col items-center justify-between">
        {/* Rotated spectrum button */}
        <button className="my-6 text-xs -rotate-90 cursor-pointer border border-eq-yellow px-2 rounded-b-sm rounded-t-xs hover:text-eq-blue hover:bg-eq-yellow">
          Spectrum Visualizer
        </button>
        {/* ===== LEFT: VOLUME CONTROLS ===== */}
        <div className="flex flex-col items-center">
          <div className="text-xs mb-2 select-none">volume</div>
          <div
            className="h-60 w-px bg-eq-yellow/50 rounded relative"
            onMouseDown={onVolumeStart}
          >
            <div
              className="absolute w-9 h-1.5 bg-eq-yellow -left-4.25"
              style={{ bottom: `${getSliderPosition(volume)}%` }}
            />
          </div>
        </div>
      </aside>

      {/* ===== CENTER: EQ CANVAS ===== */}
      <main className="w-[730px] h-[365px] relative">
        <svg
          className="absolute inset-0 w-full h-full border border-eq-yellow/50"
          viewBox="0 0 1000 500"
          preserveAspectRatio="none"
        >
          {/* Y-axis labels: -25 to 25 in 5 unit increments */}
          {[25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25].map((label) => {
            const yPos = 250 + (-label * 250) / 30; // 0-500 range, 0=30db, 500=-30db
            return (
              <g key={label}>
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
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* X-axis labels: Frequency bands */}
          {[
            5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
          ].map((freq, index) => {
            // Each spacing is 1.2x wider than the previous
            const usableWidth = 1000 - 120 - 15;
            const ratio = 1.2;
            const maxIndex = 12;
            // Geometric series: position = start + spacing * (ratio^index - 1) / (ratio - 1)
            const xPos =
              120 +
              (usableWidth * (Math.pow(ratio, index) - 1)) /
                (Math.pow(ratio, maxIndex) - 1);
            return (
              <g key={freq}>
                {/* Tick marks at bottom, top, and center */}
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
                >
                  {freq}
                </text>
                {/* lower shelf node, 9 eq nodes, higher shelf node */}
                {(index === 2 || index === 12) && (
                  <circle cx={xPos} cy="250" r="7" fill="rgb(138 104 158)" />
                )}
                {index > 2 && index < 12 && (
                  <circle cx={xPos} cy="250" r="7" fill="rgb(198 246 221)" />
                )}
              </g>
            );
          })}
        </svg>
      </main>
    </div>
  );
}
