'use client'

import { useEffect, useState } from 'react'

// Renders a complete pasted HTML design in an ISOLATED iframe so the platform's own
// CSS can never leak in and shift the design's layout (it renders exactly as the
// standalone file does). The frame auto-grows to its content height (no inner
// scrollbar), and a <base target="_top"> makes the design's nav links navigate the
// real page instead of the frame.
export default function FullPageHtml({ html, initialHeight = 1400 }: { html: string; initialHeight?: number }) {
  const [height, setHeight] = useState(initialHeight)

  const reporter =
    '<script>(function(){function r(){try{parent.postMessage({__fpH:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,document.body.offsetHeight)},"*")}catch(e){}}if(window.ResizeObserver){try{new ResizeObserver(r).observe(document.documentElement)}catch(e){}}window.addEventListener("load",r);window.addEventListener("resize",r);setTimeout(r,200);setTimeout(r,800);setTimeout(r,2000)})();<\/script>'

  const doc = /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, '<head$1><base target="_top">').replace(/<\/body>/i, reporter + '</body>')
    : '<!doctype html><html><head><base target="_top"></head><body>' + html + reporter + '</body></html>'

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const h = (e.data && (e.data as { __fpH?: number }).__fpH) || 0
      if (h > 0) setHeight(h)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return (
    <iframe
      srcDoc={doc}
      title="Page"
      scrolling="no"
      sandbox="allow-scripts allow-popups allow-forms allow-same-origin allow-top-navigation allow-popups-to-escape-sandbox"
      style={{ width: '100%', height, border: 0, display: 'block', overflow: 'hidden' }}
    />
  )
}
