import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { App } from './app/App'
import { registerServiceWorker } from './platform/pwa'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
