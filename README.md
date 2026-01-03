# Ears Audio Toolkit (EQ Chrome Extension)

A Chrome Manifest V3 audio equalizer extension built with **Vite**, **React**, and **Tailwind CSS v4**.  
Provides a clean EQ UI and a correct MV3 architecture (popup, background, content script, offscreen audio).

---

## Tech Stack

- Chrome Extension: Manifest V3
- Build Tool: Vite
- UI: React
- Styling: Tailwind CSS v4
- Audio: Web Audio API via offscreen document

## Development

Install dependencies:

```bash
npm install
UI development (no Chrome APIs):

npm run dev
Open the Vite URL and navigate to:

/popup/index.html
```

Build & Load Extension
Build:
npm run build
Load in Chrome:

Open chrome://extensions

Enable Developer mode

Click Load unpacked

Select the dist/ folder

Reload after each build

## TODO

- Canvas sizing + DPI safety
- Popup → background messaging
- Offscreen document lifecycle
- Tab audio capture
- Web Audio EQ graph
- Draw EQ grid and curve
- Draggable EQ points
- Per-tab state persistence
- Presets (save / delete / reset)
- Full-window EQ view
