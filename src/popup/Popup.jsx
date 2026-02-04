import { useEffect, useState, useRef } from "react";
import Controls from "./components/Controls";
import Guide from "./components/Guide";
import ActiveTabs from "./components/ActiveTabs";
import Pro from "./components/Pro";

import { calculateBaseQValues } from "../lib/qCalculations.js";
import { sendMessage, MSG } from "../lib/chromeMessaging.js";
import {
  clearEqStateFromLocalStorage,
  buildCompleteEqValues,
  calculateNodePositions,
  applyEqState,
  getDefaultEqValues,
} from "../lib/eqStateUtils.js";
import { useBackendSync } from "./hooks/useBackendSync.js";
import { useTheme } from "./hooks/useTheme.js";
import { useVolumeControl } from "./hooks/useVolumeControl.js";
import { useSpectrumData } from "./hooks/useSpectrumData.js";
import { usePopupBootstrap } from "./hooks/usePopupBootstrap.js";

export default function Popup() {
  const [activeTab, setActiveTab] = useState("Controls");
  const [hoveredTab, setHoveredTab] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const controlsRef = useRef(null);

  // Theme hook
  const { themeIndex, setThemeIndex, COLORS, THEMES } = useTheme();

  // EQ States (lifted from Controls)
  const [nodePositions, setNodePositions] = useState({});
  const [nodeBaseQValues, setNodeBaseQValues] = useState({});
  const [nodeQValues, setNodeQValues] = useState({});
  const [nodeGainValues, setNodeGainValues] = useState({});
  const [nodeFrequencyValues, setNodeFrequencyValues] = useState({});

  // Preset States
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Initialize EQ state from gain/frequency/Q values
  // Calculates positions, baseQ values, and updates all state
  function initializeEqState(gainValues, freqValues, qValues) {
    // Calculate node positions from frequency/gain values
    const positions = calculateNodePositions(freqValues, gainValues);

    // Convert Q values back to baseQ
    const baseQValues = calculateBaseQValues(qValues, gainValues);

    // Update all state
    setNodePositions(positions);
    setNodeGainValues(gainValues);
    setNodeFrequencyValues(freqValues);
    setNodeQValues(qValues);
    setNodeBaseQValues(baseQValues);
  }

  // Callback for bootstrap hook to set EQ state from localStorage
  function setEqStateFromLocalStorage(savedState, tabId) {
    const {
      nodePositions: savedPositions,
      nodeGainValues: savedGains,
      nodeFrequencyValues: savedFreqs,
      nodeQValues: savedQs,
      nodeBaseQValues: savedBaseQs,
    } = savedState;
    setNodePositions(savedPositions);
    setNodeGainValues(savedGains);
    setNodeFrequencyValues(savedFreqs);
    setNodeQValues(savedQs);
    setNodeBaseQValues(savedBaseQs);
    console.log("[Popup] Falling back to localStorage for EQ state");

    // Sync localStorage state to Web Audio API
    if (Object.keys(savedGains).length > 0) {
      console.log("[Popup] Syncing localStorage state to Web Audio API...");
      sendMessage({
        type: MSG.UPDATE_EQ_NODES,
        tabId: tabId,
        nodeGainValues: savedGains,
        nodeFrequencyValues: savedFreqs,
        nodeQValues: savedQs,
      });
      console.log("[Popup] localStorage state synced to Web Audio API");
    }
  }

  // Backend synchronization hook (needs nodeGainValues etc for sync)
  const { ensureBackendReady, throttledEnsureBackend } = useBackendSync(
    null, // currentTabId not available yet, will use from bootstrap
    nodeGainValues,
    nodeFrequencyValues,
    nodeBaseQValues,
  );

  // Bootstrap hook - handles tab detection, volume, backend init, EQ status
  // NOTE: setVolumeState is passed as callback, not called with currentTabId
  const { currentTabId, eqActive, setEqActive, volume, setVolumeState } =
    usePopupBootstrap(
      ensureBackendReady,
      initializeEqState,
      setEqStateFromLocalStorage,
    );

  // Volume control hook - needs currentTabId from bootstrap
  const { handleVolumeStart } = useVolumeControl(
    currentTabId,
    throttledEnsureBackend,
    setVolumeState,
  );

  // Spectrum data hook
  const spectrumData = useSpectrumData(eqActive, currentTabId);

  // Starts EQ processing for the active tab.
  async function startEq() {
    const res = await sendMessage({ type: MSG.START_EQ, tabId: currentTabId });
    if (res?.ok) {
      setEqActive(true);
      setVolumeState(1);
      // Reset all EQ states
      setNodePositions({});
      setNodeGainValues({});
      setNodeFrequencyValues({});
      setNodeQValues({});
      setNodeBaseQValues({});
    }
  }

  // Stops EQ processing for the active tab.
  async function stopEq() {
    const res = await sendMessage({ type: MSG.STOP_EQ, tabId: currentTabId });
    if (res?.ok) {
      setEqActive(false);
      setVolumeState(1);
      // Reset all EQ states
      setNodePositions({});
      setNodeGainValues({});
      setNodeFrequencyValues({});
      setNodeQValues({});
      setNodeBaseQValues({});
    }
  }

  // Stops EQ and resets all filters
  async function handleStopEqAndReset() {
    await stopEq();
    await handleResetFilters();
  }

  // Starts EQ and resets all filters
  async function handleStartEqAndReset() {
    await startEq();
    await handleResetFilters();
  }

  // Load presets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("eqPresets");
    if (stored) {
      try {
        const presets = JSON.parse(stored);
        setSavedPresets(presets);
      } catch (e) {
        console.warn("[Popup] Failed to load presets:", e);
      }
    }
  }, []);

  // Save preset to localStorage
  async function handleSavePreset() {
    if (!presetName.trim()) {
      // alert("Please enter a preset name");
      return;
    }

    const newPreset = {
      name: presetName,
      nodeGainValues,
      nodeFrequencyValues,
      nodeBaseQValues,
      timestamp: Date.now(),
    };

    // Add or update preset
    const updatedPresets = savedPresets.filter((p) => p.name !== presetName);
    updatedPresets.push(newPreset);

    localStorage.setItem("eqPresets", JSON.stringify(updatedPresets));
    setSavedPresets(updatedPresets);
    setPresetName("");
    // alert(`Preset "${presetName}" saved!`);
  }

  // Delete currently selected preset and reset all EQ filters
  async function handleDeletePreset() {
    if (!selectedPreset) {
      // alert("Please select a preset to delete");
      return;
    }

    const presetToDelete = selectedPreset;
    const updatedPresets = savedPresets.filter(
      (p) => p.name !== selectedPreset,
    );
    localStorage.setItem("eqPresets", JSON.stringify(updatedPresets));
    setSavedPresets(updatedPresets);
    setSelectedPreset(null);
    setPresetName("");

    // Reset EQ filters using the same logic as reset button
    await handleResetFilters();

    // alert(`Preset "${presetToDelete}" deleted!`);
  }

  // Apply Bass Boost preset (index 2: 120 Hz, +5 dB gain, baseQ=0.75; all others default)
  async function handleBassBoost() {
    const {
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    } = buildCompleteEqValues(
      { 2: 5 }, // 5 dB gain for index 2
      { 2: 120 }, // 120 Hz for index 2
      { 2: 0.75 }, // baseQ for index 2
    );

    // Initialize UI state
    initializeEqState(completeGainValues, completeFreqValues, completeQValues);

    // Save to localStorage and sync to Web Audio API
    await applyEqState(
      currentTabId,
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    );
  }

  // Load preset and apply it (resets all indexes to defaults, then applies preset)
  async function handleLoadPreset(presetName) {
    const preset = savedPresets.find((p) => p.name === presetName);
    if (!preset) return;

    setSelectedPreset(presetName);
    setPresetName(presetName);

    const {
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    } = buildCompleteEqValues(
      preset.nodeGainValues,
      preset.nodeFrequencyValues,
      preset.nodeBaseQValues,
    );

    // Initialize UI state with complete values
    initializeEqState(completeGainValues, completeFreqValues, completeQValues);

    // Save to localStorage and sync to Web Audio API
    await applyEqState(
      currentTabId,
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    );
  }

  // Resets all EQ filters to default values and clears preset selection
  async function handleResetFilters() {
    // Reset local state
    setNodePositions({});
    setNodeGainValues({});
    setNodeFrequencyValues({});
    setNodeQValues({});
    setNodeBaseQValues({});
    setSelectedPreset(null);
    setPresetName("");

    // Clear saved EQ state from localStorage
    clearEqStateFromLocalStorage();

    // Reset Web Audio API filters to defaults
    if (currentTabId) {
      const { completeGainValues, completeFreqValues, completeQValues } =
        getDefaultEqValues();

      await sendMessage({
        type: MSG.UPDATE_EQ_NODES,
        tabId: currentTabId,
        nodeGainValues: completeGainValues,
        nodeFrequencyValues: completeFreqValues,
        nodeQValues: completeQValues,
      });
    }
  }

  // Update EQ nodes and sync to Web Audio API
  async function handleEqNodesChange(
    newPositions,
    newGainValues,
    newFrequencyValues,
    newQValues,
    newBaseQValues,
  ) {
    // Update local state
    setNodePositions(newPositions);
    setNodeGainValues(newGainValues);
    setNodeFrequencyValues(newFrequencyValues);
    setNodeQValues(newQValues);
    setNodeBaseQValues(newBaseQValues);

    // Save to localStorage and sync to Web Audio API
    await applyEqState(
      currentTabId,
      newGainValues,
      newFrequencyValues,
      newQValues,
      newBaseQValues,
      newPositions,
    );
  }

  return (
    <div
      className="min-w-[800px] min-h-[600px] h-screen w-full overflow-hidden flex flex-col relative"
      style={{
        backgroundColor: COLORS.BACKGROUND,
        color: COLORS.TEXT,
      }}
    >
      <div className="flex-1 overflow-y-auto pb-19.5 scrollbar-none">
        {/* ================= HEADER ================= */}
        <header className="flex items-center justify-between px-3 py-2 mb-2">
          <div className="text-3xl font-bold">Airs Audio System</div>

          <div className="text-sm text-right px-1">
            <div>
              <i>
                Warning: Loud audio will damage hearing/speakers! Listen
                responsibly :)
              </i>
            </div>
            <div>
              Feel free to{" "}
              <a
                href="mailto:2017catch.21@gmail.com"
                target="_blank"
                rel="noreferrer"
              >
                <u>email me</u>
              </a>{" "}
              or visit the{" "}
              <a
                href="https://chromewebstore.google.com/detail/ibhmgglejliilciffebcbnklceoblcbe"
                target="_blank"
                rel="noreferrer"
              >
                <u>chrome web store</u>
              </a>
              .
            </div>
          </div>
        </header>

        {/* ================= TABS / TOP CONTROLS ================= */}
        <div className="pl-13">
          <div className="flex gap-1 py-0.5 text-sm">
            <button
              onClick={() => {
                throttledEnsureBackend();
                setActiveTab("Controls");
              }}
              onMouseEnter={() => setHoveredTab("Controls")}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                borderColor: COLORS.TEXT,
                ...(activeTab === "Controls" || hoveredTab === "Controls"
                  ? { color: COLORS.BACKGROUND, backgroundColor: COLORS.TEXT }
                  : {}),
              }}
              className={`px-2 py-0.5 cursor-pointer border rounded-t-lg`}
            >
              Controls
            </button>
            <button
              onClick={() => {
                throttledEnsureBackend();
                setActiveTab("Guide");
              }}
              onMouseEnter={() => setHoveredTab("Guide")}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                borderColor: COLORS.TEXT,
                ...(activeTab === "Guide" || hoveredTab === "Guide"
                  ? { color: COLORS.BACKGROUND, backgroundColor: COLORS.TEXT }
                  : {}),
              }}
              className={`px-2 py-0.5 cursor-pointer border rounded-t-lg`}
            >
              Guide
            </button>
            <button
              onClick={() => {
                throttledEnsureBackend();
                setActiveTab("ActiveTabs");
              }}
              onMouseEnter={() => setHoveredTab("ActiveTabs")}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                borderColor: COLORS.TEXT,
                ...(activeTab === "ActiveTabs" || hoveredTab === "ActiveTabs"
                  ? { color: COLORS.BACKGROUND, backgroundColor: COLORS.TEXT }
                  : {}),
              }}
              className={`px-2 py-0.5 cursor-pointer border rounded-t-lg`}
            >
              Active Tabs
            </button>
            <button
              onClick={() => {
                throttledEnsureBackend();
                setActiveTab("Pro");
              }}
              onMouseEnter={() => setHoveredTab("Pro")}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                borderColor: COLORS.TEXT,
                ...(activeTab === "Pro" || hoveredTab === "Pro"
                  ? { color: COLORS.BACKGROUND, backgroundColor: COLORS.TEXT }
                  : {}),
              }}
              className={`px-2 py-0.5 cursor-pointer border rounded-t-lg`}
            >
              Pro
            </button>
          </div>
        </div>

        {/* ================= MAIN BODY ================= */}
        {activeTab === "Controls" && (
          <Controls
            ref={controlsRef}
            volume={volume}
            onVolumeStart={handleVolumeStart}
            nodePositions={nodePositions}
            nodeGainValues={nodeGainValues}
            nodeFrequencyValues={nodeFrequencyValues}
            nodeQValues={nodeQValues}
            nodeBaseQValues={nodeBaseQValues}
            onEqNodesChange={handleEqNodesChange}
            spectrumData={spectrumData}
            eqActive={eqActive}
            themes={THEMES}
            themeIndex={themeIndex}
          />
        )}
        {activeTab === "Guide" && (
          <Guide themes={THEMES} themeIndex={themeIndex} />
        )}
        {activeTab === "ActiveTabs" && (
          <ActiveTabs themes={THEMES} themeIndex={themeIndex} />
        )}
        {activeTab === "Pro" && (
          <Pro
            themes={THEMES}
            themeIndex={themeIndex}
            onThemeChange={setThemeIndex}
          />
        )}

        {/* ================= PRESET BUTTONS ================= */}
        <div className="px-3 py-1 text-sm">
          {/* Top row: preset input + actions (right aligned) */}
          <div className="flex justify-end items-center gap-2">
            <input
              placeholder="Preset Name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSavePreset()}
              style={{
                borderColor: COLORS.TEXT,
                backgroundColor: COLORS.BACKGROUND,
                color: COLORS.TEXT,
              }}
              className="border rounded-xs text-sm w-20 outline-none placeholder-opacity-50"
            />

            <button
              onClick={handleSavePreset}
              style={{
                borderColor: COLORS.TEXT,
                ...(hoveredButton === "save"
                  ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                  : {}),
              }}
              className="px-1.5 cursor-pointer border rounded-xs"
              onMouseEnter={() => setHoveredButton("save")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              + Save Preset
            </button>

            <button
              onClick={handleDeletePreset}
              style={{
                borderColor: COLORS.TEXT,
                ...(hoveredButton === "delete"
                  ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                  : {}),
              }}
              className="px-1.5 cursor-pointer border rounded-xs"
              onMouseEnter={() => setHoveredButton("delete")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              - Delete Preset
            </button>

            <button
              onClick={handleResetFilters}
              style={{
                borderColor: COLORS.TEXT,
                ...(hoveredButton === "reset"
                  ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                  : {}),
              }}
              className="px-1.5 cursor-pointer border rounded-xs"
              onMouseEnter={() => setHoveredButton("reset")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              Reset Filters
            </button>
          </div>

          {/* Saved Presets + Quick Presets Row (right aligned) */}
          <div className="flex justify-end gap-2 mt-3 flex-wrap">
            {[...savedPresets].reverse().map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleLoadPreset(preset.name)}
                style={{
                  borderColor: COLORS.TEXT,
                  ...(hoveredButton === `preset-${preset.name}`
                    ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                    : {}),
                }}
                className="px-1.5 cursor-pointer border rounded-xs"
                onMouseEnter={() => setHoveredButton(`preset-${preset.name}`)}
                onMouseLeave={() => setHoveredButton(null)}
              >
                {preset.name}
              </button>
            ))}

            <button
              onClick={handleBassBoost}
              style={{
                borderColor: COLORS.TEXT,
                ...(hoveredButton === "bassboost"
                  ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                  : {}),
              }}
              className="px-1.5 cursor-pointer border rounded-xs"
              onMouseEnter={() => setHoveredButton("bassboost")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              Bass Boost
            </button>
          </div>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <footer
        className="absolute bottom-0 left-0 right-0 px-3 py-2 text-sm"
        style={{
          backgroundColor: `${COLORS.BACKGROUND}e6`,
        }}
      >
        {/* Centered primary action */}
        <div className="flex justify-center mb-5">
          <button
            onClick={eqActive ? handleStopEqAndReset : handleStartEqAndReset}
            style={{
              borderColor: COLORS.TEXT,
              ...(hoveredButton === "main"
                ? { backgroundColor: COLORS.TEXT, color: COLORS.BACKGROUND }
                : {}),
            }}
            className="px-1.5 cursor-pointer border rounded-xs"
            onMouseEnter={() => setHoveredButton("main")}
            onMouseLeave={() => setHoveredButton(null)}
          >
            {eqActive ? "Stop EQing This Tab" : "Start EQing This Tab"}
          </button>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div>
            <a
              href="https://buymeacoffee.com/airsaudio"
              target="_blank"
              rel="noreferrer"
            >
              ☕<u>Buy Me a Coffee</u>☕
            </a>
          </div>

          <div>
            <i>Automatically stops EQing when audio stops playing!</i>
          </div>
        </div>
      </footer>
    </div>
  );
}
