import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-files",
      closeBundle() {
        // Ensure dist exists
        if (!existsSync("dist")) mkdirSync("dist");

        // Copy manifest
        copyFileSync("manifest.json", "dist/manifest.json");

        // Copy icon (from public)
        if (existsSync("public/icon.png")) {
          copyFileSync("public/icon.png", "dist/icon.png");
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        offscreen: resolve(__dirname, "src/offscreen/offscreen.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          // Put background/content in their own folders if you later add them as entries
          return "assets/[name].js";
        },
      },
    },
  },
});
