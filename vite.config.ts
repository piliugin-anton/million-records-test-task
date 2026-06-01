import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist/client"
  }
});
