export default function Popup() {
  return (
    <div className="w-[800px] h-[600px] overflow-hidden bg-eq-blue text-eq-yellow flex flex-col relative">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-3 py-2 mb-2">
        <div className="text-3xl font-bold">Ears Audio Toolkit</div>

        <div className="text-sm text-right px-1">
          <div>
            <i>
              Warning: Loud audio will damage hearing/speakers! Listen
              responsibly :)
            </i>
          </div>
          <div>
            Feel free to <u>email me</u> or visit the <u>chrome web store</u>.
          </div>
        </div>
      </header>

      {/* ================= TABS / TOP CONTROLS ================= */}
      <div className="pl-[3.25rem]">
        <div className="flex gap-1 py-0.5 text-sm">
          <button className="px-2 py-0.5 border border-eq-yellow rounded-t-lg">
            Controls
          </button>
          <button className="px-2 py-0.5 border border-eq-yellow rounded-t-lg">
            Guide
          </button>
          <button className="px-2 py-0.5 border border-eq-yellow rounded-t-lg">
            Active Tabs
          </button>
          <button className="px-2 py-0.5 border border-eq-yellow rounded-t-lg">
            Pro
          </button>
        </div>
      </div>

      {/* ================= MAIN BODY ================= */}
      <div className="flex overflow-hidden">
        <aside className="w-12 ml-1 h-full flex flex-col items-center justify-between">
          {/* Rotated spectrum button */}
          <button className="my-6 text-xs -rotate-90 border border-eq-yellow px-2 rounded-b-sm rounded-t-xs">
            Spectrum Visualizer
          </button>
          {/* ===== LEFT: VOLUME CONTROLS ===== */}
          <div className="flex flex-col items-center">
            <div className="text-xs mb-2">volume</div>
            <div className="h-60 w-[3px] bg-eq-yellow/20 rounded relative">
              {/* volume thumb placeholder */}
              <div className="absolute bottom-1/2 w-9 h-1.5 bg-eq-yellow -left-4.25" />
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

      {/* ================= PRESET BUTTONS ================= */}
      <div className="px-3 py-1 text-sm">
        {/* Top row: presets + actions (right aligned) */}
        <div className="flex justify-end items-center gap-2">
          <input
            placeholder="Preset Name"
            className="border border-eq-yellow rounded-xs text-sm w-24"
          />

          <button className="px-1.5 border border-eq-yellow rounded-xs">
            + Save Preset
          </button>

          <button className="px-1.5 border border-eq-yellow rounded-xs">
            - Delete Preset
          </button>

          <button className="px-1.5 border border-eq-yellow rounded-xs">
            Reset Filters
          </button>
        </div>

        {/* Bottom row: quick presets (right aligned) */}
        <div className="flex justify-end gap-2 mt-3 flex-wrap">
          <button className="px-1.5 border border-eq-yellow rounded-xs">
            Bass Boost
          </button>

          <button className="px-1.5 border border-eq-yellow rounded-xs">
            YouTube
          </button>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="absolute bottom-0 left-0 right-0 px-3 py-2 text-sm">
        {/* Centered primary action */}
        <div className="flex justify-center mb-5">
          <button className="px-1.5 border border-eq-yellow rounded-xs">
            Stop EQing This Tab
          </button>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div className="text-eq-yellow">
            <u>Support development with Ears Pro!</u>
          </div>

          <div className="text-eq-yellow">
            <u>Open in Full Window</u>
          </div>
        </div>
      </footer>
    </div>
  );
}
