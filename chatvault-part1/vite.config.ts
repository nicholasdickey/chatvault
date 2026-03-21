import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build" ? [viteSingleFile()] : []),
  ],
  root: __dirname,
  server: {
    open: true,
  },
  build: {
    outDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "mcp-app.html"),
      output: {
        entryFileNames: "mcp-app.js",
        assetFileNames: "mcp-app.[ext]",
      },
    },
  },
}));
