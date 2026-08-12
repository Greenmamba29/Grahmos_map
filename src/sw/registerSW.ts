/**
 * Registers the Workbox-generated service worker (built by `vite-plugin-pwa`
 * at build time from this app's Workbox config in `vite.config.ts`). No-op
 * in dev unless `devOptions.enabled` is turned on for the plugin.
 */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // vite-plugin-pwa virtual module is unavailable outside a Vite build
      // (e.g. certain test runners) — safe to ignore.
    });
}
