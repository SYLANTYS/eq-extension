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

### Install dependencies

```bash
npm install
```

### UI development (no Chrome APIs)

```bash
npm run dev
```

Open the Vite URL and navigate to `/popup/index.html`.

### Build & load the extension

```bash
npm run build
```

Load in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the `dist/` folder.
5. Reload after each build.

## TODO

- Web Audio EQ graph
- Presets (save / delete / reset)
- Pro Tab
