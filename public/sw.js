self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

const CACHE = 'xbjz-cache-v1'
const SKIP_PREFIXES = ['/auth', '/sync', '/admin', '/recycle']

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (SKIP_PREFIXES.some((p) => url.pathname.startsWith(p))) return

  const isNav = req.mode === 'navigate'
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      if (isNav) {
        try {
          const res = await fetch(req)
          if (res && res.status === 200) cache.put(req, res.clone())
          return res
        } catch {
          return (await cache.match(req)) || (await cache.match('/')) || Response.error()
        }
      }

      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res && res.status === 200) cache.put(req, res.clone())
        return res
      } catch {
        return Response.error()
      }
    })(),
  )
})
