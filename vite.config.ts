import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'styles/*.json'],
      manifest: false,
      workbox: {
        // PMTiles archives are large and served via range requests; they are cached
        // deliberately by the offline region downloader, never by the precache manifest.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['**/tiles/**'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.pmtiles'),
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'resilience-tiles',
              rangeRequests: true,
              cacheableResponse: { statuses: [200, 206] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => /\/(tile|tiles)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'resilience-raster-tiles',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 180 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'resilience-api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // The renderer is by far the largest dependency; splitting it keeps the
        // precached app shell small enough to update over a weak connection.
        manualChunks: (id) =>
          /node_modules[\\/](maplibre-gl|pmtiles)[\\/]/.test(id) ? 'maplibre' : undefined,
      },
    },
  },
});
