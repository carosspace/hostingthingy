// Service worker for Magalis Planner (scope: /planner/). App-shell cache so it installs
// as a PWA and opens offline. The planner keeps all data in the browser's localStorage;
// this only caches the static files. API calls (api.anthropic.com) + Google Fonts are
// left to the network and never cached.
const CACHE = 'magali-planner-v2'
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()))
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
  // Only handle our own app files under /planner/ — let the API + fonts go to the network.
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/planner/')) return
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
      return res
    }).catch(() => caches.match('index.html')))
  )
})
