const CACHE = 'anima-planner-sync-v9'
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => (k === CACHE ? null : caches.delete(k))))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/planner3/')) return // /api + fonts → network
  const isDoc = req.mode === 'navigate' || req.destination === 'document' || url.pathname === '/planner3/' || url.pathname.endsWith('/index.html')
  if (isDoc) {
    // NETWORK-FIRST for the app shell → always the latest when online; cache is only the offline fallback.
    e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put('index.html', c)) } return res }).catch(() => caches.match('index.html')))
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)) } return res })))
  }
})
