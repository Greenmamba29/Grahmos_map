/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

/**
 * Offline-first: the entire app shell, venue engine, router, positioning and
 * mesh code are precached at install, so the app boots with zero network.
 */
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Serve the cached shell for every in-app navigation, online or not.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Venue packages published alongside the app (e.g. /venues/*.venue.json).
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/venues/'),
  new CacheFirst({
    cacheName: 'grahmos-venues',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
)
