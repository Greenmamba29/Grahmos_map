/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'resilience-pages',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
)

registerRoute(
  ({ url }) =>
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname === 'fonts.openmaptiles.org',
  new StaleWhileRevalidate({
    cacheName: 'resilience-map-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 1800, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

const rangeCacheKeyPlugin = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const range = request.headers.get('range')
    if (!range) return request
    const cacheKey = new URL(request.url)
    cacheKey.searchParams.set('__resilience_range', range)
    return cacheKey.toString()
  },
}

registerRoute(
  ({ url }) => url.pathname.endsWith('.pmtiles'),
  new CacheFirst({
    cacheName: 'resilience-pmtiles-ranges',
    plugins: [
      rangeCacheKeyPlugin,
      new CacheableResponsePlugin({ statuses: [200, 206] }),
      new ExpirationPlugin({ maxEntries: 4000, maxAgeSeconds: 90 * 24 * 60 * 60 }),
    ],
  }),
)
