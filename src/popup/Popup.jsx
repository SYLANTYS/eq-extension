import { useEffect, useState } from "react";

export default function Popup() {
  const [volume, setVolumeState] = useState(1);
  const [eqActive, setEqActive] = useState(true);
  const [currentTabId, setCurrentTabId] = useState(null);

  // Converts gain to slider visual position (0-100%)
  function getSliderPosition(gain) {
    if (gain === 0) return 0;
    const db = 20 * Math.log10(gain);
    const ratio = (db + 30) / 40;
    return Math.min(Math.max(ratio, 0), 1) * 100;
  }

  // Sends a message to the background script and awaits a response.
  function sendMessage(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return resolve({ ok: false, error: err.message });
        resolve(res ?? { ok: true });
      });
    });
  }

  // Handles volume slider mouse down event.
  function handleVolumeStart(e) {
    const rect = e.currentTarget.getBoundingClientRect();

    function move(ev) {
      const y = ev.clientY - rect.top;
      const ratio = 1 - Math.min(Math.max(y / rect.height, 0), 1);

      // Map ratio [0, 1] to dB [-30, 10]
      // At ratio=0 (bottom): gain=0
      // At ratio=0.75 (3/4 up): gain=1 (0dB)
      // At ratio=1 (top): gain≈3.162 (+10dB)
      let gain;
      if (ratio === 0) {
        gain = 0;
      } else {
        const db = -30 + ratio * 40;
        gain = Math.pow(10, db / 20);
      }

      setVolumeState(gain);
      setVolume(gain);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener(
      "mouseup",
      () => window.removeEventListener("mousemove", move),
      { once: true }
    );
  }

  // Starts EQ processing for the active tab.
  async function startEq() {
    const res = await sendMessage({ type: "START_EQ", tabId: currentTabId });
    if (res?.ok) {
      setEqActive(true);
      setVolumeState(1);
    }
  }

  // Stops EQ processing for the active tab.
  async function stopEq() {
    const res = await sendMessage({ type: "STOP_EQ", tabId: currentTabId });
    if (res?.ok) {
      setEqActive(false);
      setVolumeState(1);
    }
  }

  // Sets the master volume in the offscreen audio context.
  async function setVolume(value) {
    await sendMessage({
      type: "SET_VOLUME",
      value,
      tabId: currentTabId,
    });
  }

  // On mount, ping background until it's ready, then start EQ for active tab.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (cancelled || !tab?.id) return;

      setCurrentTabId(tab.id);

      // Get the current volume for this tab
      const volumeStatus = await sendMessage({
        type: "GET_VOLUME",
        tabId: tab.id,
      });

      if (volumeStatus?.ok && volumeStatus?.gain) {
        setVolumeState(volumeStatus.gain);
      }

      // Ping background until it's ready
      for (let i = 0; i < 40; i++) {
        if (cancelled) return;
        const ping = await sendMessage({ type: "PING_BG" });
        if (ping?.ok) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      if (cancelled) return;

      const status = await sendMessage({
        type: "GET_EQ_STATUS",
        tabId: tab.id,
      });

      if (status?.active) {
        setEqActive(true);

        return; // already running, don't auto-start again
      }

      // Auto-start EQ for this tab if not already active
      const res = await sendMessage({ type: "START_EQ", tabId: tab.id });
      if (res?.ok) setEqActive(true);
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-[800px] h-[600px] overflow-hidden bg-eq-blue text-eq-yellow flex flex-col relative">
      <div className="flex-1 overflow-y-auto pb-22.5 scrollbar-none">
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
        <div className="pl-13">
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
          <aside className="w-12 ml-1 flex flex-col items-center justify-between">
            {/* Rotated spectrum button */}
            <button className="my-6 text-xs -rotate-90 border border-eq-yellow px-2 rounded-b-sm rounded-t-xs">
              Spectrum Visualizer
            </button>
            {/* ===== LEFT: VOLUME CONTROLS ===== */}
            <div className="flex flex-col items-center">
              <div className="text-xs mb-2 select-none">volume</div>
              <div
                className="h-60 w-px bg-eq-yellow/50 rounded relative"
                onMouseDown={handleVolumeStart}
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

        {/* ================= PRESET BUTTONS ================= */}
        <div className="px-3 py-1 text-sm">
          {/* Top row: presets + actions (right aligned) */}
          <div className="flex justify-end items-center gap-2">
            <input
              placeholder="Preset Name"
              className="border border-eq-yellow rounded-xs text-sm w-20 outline-none"
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
      </div>

      {/* ================= FOOTER ================= */}
      <footer className="absolute bottom-0 left-0 right-0 px-3 py-2 text-sm bg-eq-blue/90">
        {/* Centered primary action */}
        <div className="flex justify-center mb-5">
          <button
            onClick={eqActive ? stopEq : startEq}
            className="px-1.5 cursor-pointer border border-eq-yellow rounded-xs hover:text-eq-blue hover:bg-eq-yellow"
          >
            {eqActive ? "Stop EQing This Tab" : "Start EQing This Tab"}
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
