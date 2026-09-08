/* Service Worker — Proyecto Emilio
 * Cachea el shell PWA y páginas estáticas. No cachea respuestas privadas
 * de la API ni HTML autenticado de forma agresiva.
 */
const CACHE_NAME = 'proyecto-emilio-shell-v2'
const SHELL_URLS = ['/offline.html', '/manifest.json', '/icon-192.png']

self.addEventListener('install', (event) => {
  const e = /** @type {ExtendableEvent} */ (event)
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => {
      return /** @type {ServiceWorkerGlobalScope} */ (self).skipWaiting()
    })
  )
})

self.addEventListener('activate', (event) => {
  const e = /** @type {ExtendableEvent} */ (event)
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('proyecto-emilio-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => /** @type {ServiceWorkerGlobalScope} */ (self).clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const e = /** @type {FetchEvent} */ (event)
  const req = e.request
  const url = new URL(req.url)

  if (req.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Nunca persistir HTML privado: incluye datos financieros y estado de sesión.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(async () => (await caches.match('/offline.html')) || Response.error())
    )
    return
  }

  // Assets estáticos: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json'
  ) {
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (!res.ok || res.redirected || res.headers.get('content-type')?.includes('text/html')) return res
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
          return res
        })
      })
    )
  }
})
