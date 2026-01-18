import { useEffect, useState, useRef } from "react";
import Controls from "./components/Controls";
import Guide from "./components/Guide";
import ActiveTabs from "./components/ActiveTabs";
import Pro from "./components/Pro";

// Theme definitions - add new themes as additional objects
const THEMES = [
  //default
  {
    BACKGROUND: "#2c3e50",
    TEXT: "#f5deb3",
    POINT: "#c6f6dd",
    SHELF: "#8a689e",
  },
  //USA
  {
    BACKGROUND: "#1f2f4a",
    TEXT: "#dddddd",
    POINT: "#ffffff",
    SHELF: "#b02020",
  },
  //monochrome
  {
    BACKGROUND: "#242424",
    TEXT: "#cccccc",
    POINT: "#ffffff",
    SHELF: "#0a0a0a",
  },
  //terminal
  {
    BACKGROUND: "#070b09",
    TEXT: "#7fe3ae",
    POINT: "#bfead3",
    SHELF: "#4b5fe0",
  },
  //red and white
  {
    BACKGROUND: "#f1f0dc",
    TEXT: "#8b1a1a",
    POINT: "#ba3434",
    SHELF: "#4a0000",
  },
  //purple gold
  {
    BACKGROUND: "#2a2436",
    TEXT: "#f2d9a6",
    POINT: "#e6c27a",
    SHELF: "#7a4f9a",
  },
  //Hungary / Italy
  {
    BACKGROUND: "#7a1414",
    TEXT: "#ffffff",
    POINT: "#2fbf5f",
    SHELF: "#ffffff",
  },
];

export default function Popup() {
  const [volume, setVolumeState] = useState(1);
  const [eqActive, setEqActive] = useState(true);
  const [currentTabId, setCurrentTabId] = useState(null);
  const [activeTab, setActiveTab] = useState("Controls");
  const [themeIndex, setThemeIndex] = useState(() => {
    // Load theme from localStorage or default to 0
    const stored = localStorage.getItem("eqThemeIndex");
    return stored ? JSON.parse(stored) : 1;
  });
  const [hoveredTab, setHoveredTab] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);
  const controlsRef = useRef(null);

  // Get current theme colors
  const COLORS = THEMES[themeIndex];

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

  // Spectrum Visualizer State
  const [spectrumData, setSpectrumData] = useState([]);

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

  // Save current EQ node state to localStorage
  // Used for persistence after offscreen restarts
  function saveEqStateToLocalStorage(positions, gains, freqs, qs, baseQs) {
    const eqState = {
      nodePositions: positions,
      nodeGainValues: gains,
      nodeFrequencyValues: freqs,
      nodeQValues: qs,
      nodeBaseQValues: baseQs,
      timestamp: Date.now(),
    };
    localStorage.setItem("eqCurrentState", JSON.stringify(eqState));
    console.log("[Popup] EQ state saved to localStorage");
  }

  // Load EQ node state from localStorage
  // Returns null if no saved state exists
  function loadEqStateFromLocalStorage() {
    try {
      const stored = localStorage.getItem("eqCurrentState");
      if (stored) {
        const eqState = JSON.parse(stored);
        console.log("[Popup] EQ state loaded from localStorage");
        return eqState;
      }
    } catch (e) {
      console.warn("[Popup] Failed to load EQ state from localStorage:", e);
    }
    return null;
  }

  // Ensure background and offscreen are ready by pinging BG and reinitializing missing audio.
  // Call this before critical operations to guarantee service worker and offscreen are alive.
  async function ensureBackendReady() {
    // Ping background until it's ready
    for (let i = 0; i < 40; i++) {
      const ping = await sendMessage({ type: "PING_BG" });
      if (ping?.ok) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    // Reinitialize any missing audio graphs in offscreen
    await sendMessage({ type: "REINIT_MISSING_AUDIO" });

    // Rehydrate Web Audio API with current UI state (fallback if no saved state)
    if (currentTabId && Object.keys(nodeGainValues).length > 0) {
      // Recalculate Q values from baseQ and current gains before sending
      const recalculatedQValues = {};
      for (let i = 0; i < 13; i++) {
        const isShelf = i === 2 || i === 12;
        const baseQ = nodeBaseQValues[i] ?? (isShelf ? 0.75 : 0.3);
        const gain = nodeGainValues[i] ?? 0;
        recalculatedQValues[i] = isShelf
          ? baseQ
          : baseQ * (1.5 - Math.abs(gain) / 30);
      }

      await sendMessage({
        type: "UPDATE_EQ_NODES",
        tabId: currentTabId,
        nodeGainValues,
        nodeFrequencyValues,
        nodeQValues: recalculatedQValues,
      });
    }
  }

  // Throttle tracking for ensuring backend is ready (1 second cooldown)
  const lastEnsureTimeRef = useRef(0);

  // Build complete EQ value objects with all indexes (defaults + overrides)
  function buildCompleteEqValues(
    overrideGainValues = {},
    overrideFreqValues = {},
    overrideBaseQValues = {},
  ) {
    const frequencies = [
      5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
    ];
    const completeGainValues = {};
    const completeFreqValues = {};
    const completeBaseQValues = {};
    const completeQValues = {};

    // Set all indexes to defaults first
    for (let i = 0; i < frequencies.length; i++) {
      completeGainValues[i] = 0; // 0 dB default
      completeFreqValues[i] = frequencies[i];
      // Default baseQ values: 0.75 for shelves, 0.3 for peaking
      completeBaseQValues[i] = i === 2 || i === 12 ? 0.75 : 0.3;
    }

    // Override with provided values
    Object.assign(completeGainValues, overrideGainValues);
    Object.assign(completeFreqValues, overrideFreqValues);
    Object.assign(completeBaseQValues, overrideBaseQValues);

    // Calculate Q values from baseQ and gain (no unnecessary conversions)
    for (let i = 0; i < frequencies.length; i++) {
      const baseQ = completeBaseQValues[i];
      const gain = completeGainValues[i];
      completeQValues[i] = baseQToQ(i, baseQ, gain);
    }

    return {
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    };
  }

  // Throttled ensure backend ready with 1 second cooldown
  async function throttledEnsureBackend() {
    const now = Date.now();
    if (now - lastEnsureTimeRef.current < 1000) {
      return; // Skip if called within last 1 second
    }
    lastEnsureTimeRef.current = now;
    await ensureBackendReady();
  }

  // Handles volume slider mouse down event (with throttled backend ensure).
  function handleVolumeStart(e) {
    throttledEnsureBackend();

    const rect = e.currentTarget.getBoundingClientRect();

    function move(ev) {
      const y = ev.clientY - rect.top + 3;
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

      setVolumeState(gain); // slight offset for better UX
      setVolume(gain);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener(
      "mouseup",
      () => window.removeEventListener("mousemove", move),
      { once: true },
    );
  }

  // Starts EQ processing for the active tab.
  async function startEq() {
    const res = await sendMessage({ type: "START_EQ", tabId: currentTabId });
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
    const res = await sendMessage({ type: "STOP_EQ", tabId: currentTabId });
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

  // Sets the master volume in the offscreen audio context.
  async function setVolume(value) {
    await sendMessage({
      type: "SET_VOLUME",
      value,
      tabId: currentTabId,
    });
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

    // Save to localStorage for persistence after offscreen restarts
    const positions = calculateNodePositions(
      completeFreqValues,
      completeGainValues,
      [5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480],
    );
    saveEqStateToLocalStorage(
      positions,
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    );

    // Sync to Web Audio API
    if (currentTabId) {
      await sendMessage({
        type: "UPDATE_EQ_NODES",
        tabId: currentTabId,
        nodeGainValues: completeGainValues,
        nodeFrequencyValues: completeFreqValues,
        nodeQValues: completeQValues,
      });
    }
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

    // Save to localStorage for persistence after offscreen restarts
    const positions = calculateNodePositions(
      completeFreqValues,
      completeGainValues,
      [5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480],
    );
    saveEqStateToLocalStorage(
      positions,
      completeGainValues,
      completeFreqValues,
      completeQValues,
      completeBaseQValues,
    );

    // Sync to Web Audio API
    if (currentTabId) {
      await sendMessage({
        type: "UPDATE_EQ_NODES",
        tabId: currentTabId,
        nodeGainValues: completeGainValues,
        nodeFrequencyValues: completeFreqValues,
        nodeQValues: completeQValues,
      });
    }
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
    localStorage.removeItem("eqCurrentState");

    // Reset Web Audio API filters to defaults
    if (currentTabId) {
      const frequencies = [
        5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
      ];
      const defaultGainValues = {};
      const defaultFreqValues = {};
      const defaultQValues = {};

      // Set all filters to their default values
      for (let i = 0; i < frequencies.length; i++) {
        defaultGainValues[i] = 0; // 0 dB (no boost/cut)
        defaultFreqValues[i] = frequencies[i];
        defaultQValues[i] = i === 2 || i === 12 ? 0.75 : 0.3; // Shelf Q vs peaking Q
      }

      await sendMessage({
        type: "UPDATE_EQ_NODES",
        tabId: currentTabId,
        nodeGainValues: defaultGainValues,
        nodeFrequencyValues: defaultFreqValues,
        nodeQValues: defaultQValues,
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

    // Save to localStorage for persistence after offscreen restarts
    saveEqStateToLocalStorage(
      newPositions,
      newGainValues,
      newFrequencyValues,
      newQValues,
      newBaseQValues,
    );

    // Sync to Web Audio API via background
    if (currentTabId) {
      await sendMessage({
        type: "UPDATE_EQ_NODES",
        tabId: currentTabId,
        nodeGainValues: newGainValues,
        nodeFrequencyValues: newFrequencyValues,
        nodeQValues: newQValues,
      });
    }
  }

  // Helper function to convert baseQ to Q
  // Formula: Q = isShelf ? baseQ : baseQ * (1.5 - Math.abs(gaindB) / 30)
  function baseQToQ(index, baseQ, gaindB) {
    const isShelf = index === 2 || index === 12;
    if (isShelf) {
      return baseQ; // For shelves, Q and baseQ are the same
    } else {
      const multiplier = 1.5 - Math.abs(gaindB) / 30;
      return baseQ * multiplier;
    }
  }

  // Helper function to convert Q back to baseQ
  // Formula: Q = isShelf ? baseQ : baseQ * (1.5 - Math.abs(gaindB) / 30)
  // Reverse: baseQ = Q / (1.5 - Math.abs(gaindB) / 30)
  function qToBaseQ(index, q, gaindB) {
    const isShelf = index === 2 || index === 12;
    if (isShelf) {
      return q; // For shelves, Q and baseQ are the same
    } else {
      const divisor = 1.5 - Math.abs(gaindB) / 30;
      return divisor !== 0 ? q / divisor : 0.3; // Fallback to default
    }
  }

  // Initialize EQ state from gain/frequency/Q values
  // Calculates positions, baseQ values, and updates all state
  function initializeEqState(gainValues, freqValues, qValues) {
    const frequencies = [
      5, 10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10240, 20480,
    ];

    // Calculate node positions from frequency/gain values
    const positions = calculateNodePositions(
      freqValues,
      gainValues,
      frequencies,
    );

    // Convert Q values back to baseQ
    const baseQValues = {};
    for (const indexStr in qValues) {
      const index = parseInt(indexStr, 10);
      const baseQ = qToBaseQ(index, qValues[index], gainValues[index] ?? 0);
      baseQValues[index] = baseQ;
    }

    // Update all state
    setNodePositions(positions);
    setNodeGainValues(gainValues);
    setNodeFrequencyValues(freqValues);
    setNodeQValues(qValues);
    setNodeBaseQValues(baseQValues);
  }

  // Convert node positions from Web Audio API values to UI coordinates
  // This is used during initialization to populate node positions
  function calculateNodePositions(
    nodeFrequencyValues,
    nodeGainValues,
    frequencies,
  ) {
    const positions = {};
    const SVG_HEIGHT = 500;
    const CENTER_Y = 250;
    const X_AXIS_START = 120;
    const X_AXIS_END = 15;
    const USABLE_WIDTH = 1000 - X_AXIS_START - X_AXIS_END;
    const GEOMETRIC_RATIO = 1.2;

    const maxIndex = frequencies.length - 1;

    for (const indexStr in nodeFrequencyValues) {
      const index = parseInt(indexStr, 10);
      const freq = nodeFrequencyValues[index];
      const gainDb = nodeGainValues[index] ?? 0;

      // Calculate X offset based on frequency
      const baseX =
        X_AXIS_START +
        (USABLE_WIDTH * (Math.pow(GEOMETRIC_RATIO, index) - 1)) /
          (Math.pow(GEOMETRIC_RATIO, maxIndex) - 1);

      // Reverse frequency mapping to get X position
      const minFreq = frequencies[0];
      const maxFreq = frequencies[frequencies.length - 1];
      const logRatio = Math.log(freq / minFreq) / Math.log(maxFreq / minFreq);
      const indexFloat = logRatio * maxIndex;
      const denominator = Math.pow(GEOMETRIC_RATIO, maxIndex) - 1;
      const normalizedX =
        (Math.pow(GEOMETRIC_RATIO, indexFloat) - 1) / denominator;
      const currentX = X_AXIS_START + normalizedX * USABLE_WIDTH;

      const offsetX = currentX - baseX;
      const offsetY = -(gainDb / 60) * SVG_HEIGHT;

      positions[index] = { x: offsetX, y: offsetY };
    }

    return positions;
  }

  // On mount, ensure backend is ready and check if EQ is already active for this tab.
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

      if (cancelled) return;

      // Ensure backend is ready FIRST before fetching from Web Audio API
      await ensureBackendReady();

      if (cancelled) return;

      const status = await sendMessage({
        type: "GET_EQ_STATUS",
        tabId: tab.id,
      });

      if (status?.active) {
        setEqActive(true);
      }

      if (cancelled) return;

      // Check if we need to START_EQ
      if (!status?.active) {
        // Auto-start EQ for this tab if not already active
        const res = await sendMessage({ type: "START_EQ", tabId: tab.id });
        if (res?.ok) setEqActive(true);

        if (cancelled) return;

        // Give offscreen time to initialize audio graphs
        await new Promise((r) => setTimeout(r, 150));
      }

      // PRIMARY: Fetch current EQ state from Web Audio API (source of truth)
      let webAudioState = null;
      try {
        const eqNodeStatus = await sendMessage({
          type: "GET_EQ_NODES",
          tabId: tab.id,
        });

        if (eqNodeStatus?.ok) {
          const gainValues = eqNodeStatus.nodeGainValues || {};
          const freqValues = eqNodeStatus.nodeFrequencyValues || {};
          const qValues = eqNodeStatus.nodeQValues || {};

          // If Web Audio API has values, use them as source of truth
          if (Object.keys(gainValues).length > 0) {
            webAudioState = {
              gainValues,
              freqValues,
              qValues,
            };
            initializeEqState(gainValues, freqValues, qValues);
            console.log(
              "[Popup] Web Audio API has EQ state, using it as source of truth",
            );
          }
        }
      } catch (e) {
        console.warn("[Popup] Failed to fetch EQ state from Web Audio API:", e);
      }

      if (cancelled) return;

      // FALLBACK: If Web Audio API had no state, load from localStorage
      if (!webAudioState) {
        const savedState = loadEqStateFromLocalStorage();
        if (savedState) {
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
            console.log(
              "[Popup] Syncing localStorage state to Web Audio API...",
            );
            await sendMessage({
              type: "UPDATE_EQ_NODES",
              tabId: tab.id,
              nodeGainValues: savedGains,
              nodeFrequencyValues: savedFreqs,
              nodeQValues: savedQs,
            });
            console.log("[Popup] localStorage state synced to Web Audio API");
          }
        }
      }
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch spectrum data continuously when EQ is active
  useEffect(() => {
    if (!eqActive || !currentTabId) return;

    let animationFrameId;

    async function fetchSpectrum() {
      try {
        const res = await sendMessage({
          type: "GET_SPECTRUM_DATA",
          tabId: currentTabId,
        });

        if (res?.ok && res?.spectrumData) {
          setSpectrumData(res.spectrumData);
        }
      } catch (e) {
        console.warn("[Popup] Failed to fetch spectrum data:", e);
      }

      // Schedule next fetch for next animation frame
      animationFrameId = requestAnimationFrame(fetchSpectrum);
    }

    // Start fetching spectrum data
    fetchSpectrum();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [eqActive, currentTabId]);

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
                href="https://chromewebstore.google.com/detail/airs-audio-system/ibhmgglejliilciffebcbnklceoblcbe"
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
