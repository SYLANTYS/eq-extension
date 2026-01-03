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
        // Ensure folders
        mkdirSync("dist/background", { recursive: true });
        mkdirSync("dist/content", { recursive: true });

        // Copy manifest
        copyFileSync("manifest.json", "dist/manifest.json");

        // Copy icon
        if (existsSync("public/icon.png")) {
          copyFileSync("public/icon.png", "dist/icon.png");
        }

        // Copy background + content scripts
        copyFileSync(
          "src/background/background.js",
          "dist/background/background.js"
        );

        copyFileSync("src/content/content.js", "dist/content/content.js");
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/index.html"),
        offscreen: resolve(__dirname, "offscreen/offscreen.html"),
      },
    },
  },
});
