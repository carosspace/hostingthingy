// Service worker for "The Softening" (scope: /the-softening/). App-shell cache so it
// installs as a PWA and opens offline. All state lives in the browser's localStorage;
// this only caches the static files. Google Fonts are cached opportunistically; any
// other cross-origin request is left to the network.
const CACHE = 'softening-v2'
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameApp = url.origin === self.location.origin && url.pathname.startsWith('/the-softening/')
  const isFont = url.hostname.indexOf('gstatic') > -1 || url.hostname.indexOf('googleapis') > -1
  if (!sameApp && !isFont) return
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
      return res
    }).catch(() => (sameApp ? caches.match('index.html') : undefined)))
  )
})
