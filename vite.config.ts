import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(root, "src/client"),
  plugins: [react()],
  build: {
    outDir: path.resolve(root, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3010",
      "/login": "http://localhost:3010",
      "/logout": "http://localhost:3010",
      "/whoami": "http://localhost:3010",
      "/shorten": "http://localhost:3010",
      "/health": "http://localhost:3010",
      "/ws": { target: "ws://localhost:3010", ws: true },
    },
  },
});
