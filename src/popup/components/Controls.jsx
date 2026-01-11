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
        <div className="absolute inset-0 flex items-center justify-center border border-eq-yellow/50">
          {/* Replace this with <canvas /> later 750px by 380px */}
          EQ Canvas Area
        </div>
      </main>
    </div>
  );
}
