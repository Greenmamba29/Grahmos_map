import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Resilience Maps",
        short_name: "Resilience Maps",
        description:
          "Offline-first mapping for locating critical infrastructure during outages.",
        theme_color: "#1A73E8",
        background_color: "#ffffff",
        display: "standalone",
        icons: [],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /\/tiles\/.*\.pmtiles$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pmtiles-cache",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/facilities.*/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "facilities-api-cache" },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
