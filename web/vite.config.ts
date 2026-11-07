import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Proxies /api to the NestJS API (default port 3000 - change to match apps/api).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
});
