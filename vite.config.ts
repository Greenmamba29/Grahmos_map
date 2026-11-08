import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'GrahmOS Maps — Offline Indoor',
        short_name: 'GrahmOS Maps',
        description: 'Offline indoor maps, Bluetooth positioning and peer-to-peer mesh. No internet required.',
        theme_color: '#1A73E8',
        background_color: '#F6F8FB',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        categories: ['navigation', 'utilities'],
        icons: [
          {
            src: '/icons/map-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
