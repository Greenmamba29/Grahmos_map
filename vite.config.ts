import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlinePrecache } from './vite-plugins/precache.ts'

export default defineConfig({
  plugins: [react(), offlinePrecache({ entry: 'src/service-worker.ts' })],
})
