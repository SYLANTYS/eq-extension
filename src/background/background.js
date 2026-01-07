// background/background.js

console.log("[BG] Service worker loaded");

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();

  if (!has) {
    console.log("[BG] Creating offscreen document…");

    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Audio processing for EQ extension",
    });

    console.log("[BG] Offscreen document created");
  } else {
    console.log("[BG] Offscreen document already exists");
  }
}

// Run once when the service worker wakes
ensureOffscreen();

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  console.log("[BG] Message received:", msg);

  if (msg.type === "PING_BG") {
    return;
  }
});
