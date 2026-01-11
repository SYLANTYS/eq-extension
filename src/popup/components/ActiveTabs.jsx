import { useEffect, useState } from "react";

export default function ActiveTabs() {
  const [activeTabs, setActiveTabs] = useState([]);

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

  // Fetch all active tabs and their details on mount
  useEffect(() => {
    async function loadActiveTabs() {
      try {
        // Get all tab IDs with active EQ
        const res = await sendMessage({ type: "GET_ALL_ACTIVE_TABS" });
        if (!res?.ok || !res?.tabIds) return;

        // Fetch full tab details for each active tab
        const tabDetails = await Promise.all(
          res.tabIds.map((tabId) => chrome.tabs.get(tabId).catch(() => null))
        );

        // Filter out null results and set state
        setActiveTabs(tabDetails.filter((tab) => tab !== null));
      } catch (e) {
        console.error("Failed to load active tabs:", e);
      }
    }

    loadActiveTabs();
  }, []);

  // Stop EQ for a specific tab
  async function handleStopEq(tabId) {
    await sendMessage({ type: "STOP_EQ", tabId });
    // Remove from list
    setActiveTabs((prev) => prev.filter((tab) => tab.id !== tabId));
  }

  return (
    <div className="w-[730px] h-[365px] ml-13 flex items-center justify-center">
      <div className="w-100 text-sm overflow-y-auto max-h-[365px] scrollbar-none">
        {activeTabs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-eq-yellow/50">
            No active tabs
          </div>
        ) : (
          activeTabs.map((tab) => (
            <div key={tab.id} className="flex gap-2 mb-1 items-center">
              <button
                onClick={() => handleStopEq(tab.id)}
                className="flex items-center gap-1 px-1.5 cursor-pointer border border-eq-yellow rounded-xs hover:text-eq-blue hover:bg-eq-yellow whitespace-nowrap"
              >
                <p>Stop EQing</p>
                {tab.favIconUrl && (
                  <img src={tab.favIconUrl} alt="favicon" className="w-4 h-4" />
                )}
                {!tab.favIconUrl && <div className="w-4 h-4"></div>}
              </button>

              <p className="flex-1 truncate">{tab.title}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
