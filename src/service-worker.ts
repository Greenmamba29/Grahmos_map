/// <reference lib="webworker" />

/**
 * Offline-first service worker. Every built asset is precached at install (list injected at build time by
 * vite-plugins/precache.ts), so the app boots, routes, positions and meshes with zero network.
 */
export {}

declare let self: ServiceWorkerGlobalScope
declare const __PRECACHE_MANIFEST__: { url: string; revision: string }[]
declare const __PRECACHE_VERSION__: string

const PREFIX = 'grahmos-precache-'
const CACHE = `${PREFIX}${__PRECACHE_VERSION__}`
const VENUES = 'grahmos-venues'
const urls = __PRECACHE_MANIFEST__.map((e) => e.url)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(urls.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage('grahmos:offline-ready')
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // In-app navigation: the cached shell, always (works offline, updates when a new worker installs).
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('/index.html', { cacheName: CACHE }).then((hit) => hit ?? fetch(request)))
    return
  }

  // Venue packages published next to the app: cache-first, refreshed on success.
  if (url.pathname.startsWith('/venues/')) {
    event.respondWith(
      caches.open(VENUES).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      }),
    )
    return
  }

  if (urls.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: CACHE }).then((hit) => hit ?? fetch(request)))
  }
})
