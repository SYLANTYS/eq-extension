export default function Popup() {
  return (
    <div className="w-[720px] h-[420px] overflow-hidden bg-slate-800 text-slate-100 flex flex-col">
      {/* ================= HEADER ================= */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="text-lg font-semibold">Ears Audio Toolkit</div>

        <div className="text-xs text-yellow-300">
          Warning: Loud audio will damage hearing
        </div>
      </header>

      {/* ================= TABS / TOP CONTROLS ================= */}
      <div className="flex gap-2 px-4 py-2 border-b border-slate-700 text-sm">
        <button className="px-2 py-1 bg-slate-700 rounded">Controls</button>
        <button className="px-2 py-1 bg-slate-700 rounded">Guide</button>
        <button className="px-2 py-1 bg-slate-700 rounded">Active Tabs</button>
        <button className="px-2 py-1 bg-yellow-600 text-black rounded">
          Pro
        </button>
      </div>

      {/* ================= MAIN BODY ================= */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== LEFT: VOLUME / SIDE CONTROLS ===== */}
        <aside className="w-16 flex flex-col items-center justify-center border-r border-slate-700">
          <div className="text-xs mb-2 -rotate-90">Volume</div>

          <div className="h-40 w-2 bg-slate-600 rounded relative">
            {/* volume thumb placeholder */}
            <div className="absolute bottom-1/2 w-4 h-2 bg-slate-300 -left-1 rounded" />
          </div>
        </aside>

        {/* ===== CENTER: EQ CANVAS ===== */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            {/* Replace this with <canvas /> later */}
            EQ Canvas Area
          </div>
        </main>
      </div>

      {/* ================= PRESET / ACTION BUTTONS ================= */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-700 text-sm">
        <input
          placeholder="Preset Name"
          className="bg-slate-700 px-2 py-1 rounded text-sm w-32"
        />

        <button className="px-2 py-1 bg-slate-700 rounded">
          + Save Preset
        </button>

        <button className="px-2 py-1 bg-slate-700 rounded">
          - Delete Preset
        </button>

        <button className="px-2 py-1 bg-slate-700 rounded">
          Reset Filters
        </button>

        <div className="ml-auto flex gap-2">
          <button className="px-2 py-1 bg-slate-700 rounded">Bass Boost</button>

          <button className="px-2 py-1 bg-slate-700 rounded">YouTube</button>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-slate-700 text-xs">
        <button className="px-2 py-1 bg-red-600 rounded">
          Stop EQing This Tab
        </button>

        <div className="text-slate-400">Open in Full Window</div>
      </footer>
    </div>
  );
}
