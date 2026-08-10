// Service worker for "Le Grimoire" (scope: /le-grimoire/). App-shell cache so it
// installs as a PWA and opens offline. All state lives in the browser's localStorage;
// this only caches the static files. The document is fetched network-first (so updates
// show up without a cache trap); other same-app assets and Google Fonts are cache-first.
const CACHE = 'grimoire-v1'
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
  const sameApp = url.origin === self.location.origin && url.pathname.startsWith('/le-grimoire/')
  const isFont = url.hostname.indexOf('gstatic') > -1 || url.hostname.indexOf('googleapis') > -1
  if (!sameApp && !isFont) return
  const isDoc = req.mode === 'navigate' || req.destination === 'document' || url.pathname === '/le-grimoire/' || url.pathname.endsWith('/index.html')
  if (isDoc) {
    e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put('index.html', c)) } return res }).catch(() => caches.match('index.html')))
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)) } return res })))
  }
})
