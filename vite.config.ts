import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Resilience Maps",
        short_name: "Resilience",
        description:
          "Offline-first map of critical infrastructure: hospitals, schools, shelters, water, power and comms.",
        theme_color: "#1A73E8",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // PMTiles archives are fetched with HTTP Range requests; CacheFirst
            // with rangeRequests lets downloaded regions render fully offline.
            urlPattern: /\.pmtiles(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pmtiles",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: { maxEntries: 16, purgeOnQuotaError: false },
            },
          },
          {
            // Fallback online basemap style + glyphs/sprites (OpenFreeMap).
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "basemap-online",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 2000 },
            },
          },
        ],
      },
    }),
  ],
});
