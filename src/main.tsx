import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import 'maplibre-gl/dist/maplibre-gl.css'
import './styles.css'
import { App } from './app/App'

registerSW({
  immediate: true,
  onOfflineReady: () => window.dispatchEvent(new Event('resilience:offline-ready')),
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
