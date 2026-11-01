import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    watch: { usePolling: process.env.DOCKER_WATCH_POLLING === "true" },
  },
  plugins: [
    react(),
    tailwindcss(), // <-- É isso aqui que faz a mágica do v4 acontecer!
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
