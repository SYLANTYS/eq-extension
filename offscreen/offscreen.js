console.log("[OFFSCREEN] Offscreen audio context script loaded");

chrome.runtime.onMessage.addListener((msg) => {
  console.log("[OFFSCREEN] Message received:", msg);
});
