'use client'

import { useEffect } from 'react'

// Counts one view of a public page, once per load. Renders nothing.
//
// Stores no cookie and no identifier: sessionStorage only marks "this browser tab has
// already been counted once" so repeat page views don't each look like a new visitor, and
// it disappears when the tab closes. Visiting ?notrack=1 opts a browser out permanently
// (that's how Caro stops her own visits counting — the dashboard links to it).
const OPT_OUT = 'anima_no_track'
const SEEN = 'anima_seen'

export default function PageViewTracker({ slug, path }: { slug: string; path: string }) {
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('notrack') === '1') {
        localStorage.setItem(OPT_OUT, '1')
        return
      }
      if (localStorage.getItem(OPT_OUT) === '1') return

      const newVisit = !sessionStorage.getItem(SEEN)
      sessionStorage.setItem(SEEN, '1')

      // Only outside referrers are interesting; clicks within the site are not "sources".
      let ref = ''
      if (document.referrer) {
        try {
          const h = new URL(document.referrer).host
          if (h && h.replace(/^www\./, '') !== window.location.host.replace(/^www\./, '')) ref = h
        } catch { /* malformed referrer — ignore */ }
      }

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          path,
          ref,
          device: window.matchMedia('(max-width: 820px)').matches ? 'mobile' : 'desktop',
          newVisit,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // private-mode storage errors etc. — never let counting break the page
    }
  }, [slug, path])

  return null
}
