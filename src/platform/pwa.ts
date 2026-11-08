import { isNativeShell } from './native'

/**
 * Registers the offline service worker in production web builds. Skipped in dev, inside the native shell
 * (assets are already on the device and iOS WKWebView has no service workers), and on insecure origins.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || isNativeShell() || !('serviceWorker' in navigator) || !window.isSecureContext) return
  const ready = () => window.dispatchEvent(new Event('grahmos:offline-ready'))
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data === 'grahmos:offline-ready') ready()
  })
  navigator.serviceWorker
    .register('/service-worker.js')
    .then(async (registration) => {
      await navigator.serviceWorker.ready
      if (registration.active) ready()
    })
    .catch((error) => console.warn('[grahmos] service worker registration failed', error))
}
