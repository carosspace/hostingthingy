'use client'

import { useEffect, useRef } from 'react'
import { parseFullPage, fullPageCss } from './fullpage'

// Renders a pasted full-page design INLINE (server-rendered markup, no iframe) so its text,
// headings and links are part of the page crawlers see. The design's own <style>/<link> come
// with it, guarded by the reset + body overrides in fullpage.ts.
//
// Markup injected as innerHTML never runs its <script> tags, so they're re-created on mount —
// that's what keeps the interactive pages (contact form, mantra, smooth-scroll) working.
export default function InlineFullPage({ html }: { html: string }) {
  const parsed = parseFullPage(html)
  const rootRef = useRef<HTMLDivElement>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !parsed.scripts.length) return
    ran.current = true
    const added: HTMLScriptElement[] = []
    for (const s of parsed.scripts) {
      const el = document.createElement('script')
      if (s.src) { el.src = s.src; el.async = false } else { el.textContent = s.code ?? '' }
      document.body.appendChild(el)
      added.push(el)
    }
    return () => { added.forEach(el => el.remove()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  return (
    <>
      {parsed.cssLinks.map((l, i) => (
        <link key={`fpl-${i}`} rel={l.rel} href={l.href} crossOrigin={l.crossOrigin as '' | 'anonymous' | 'use-credentials' | undefined} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: fullPageCss(parsed) }} />
      <div id="fp-root" ref={rootRef} dangerouslySetInnerHTML={{ __html: parsed.body }} />
    </>
  )
}
