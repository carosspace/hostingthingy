'use client'

import { useEffect, useLayoutEffect } from 'react'

// useLayoutEffect on the client, a no-op useEffect during SSR (silences the warning).
const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Drives scroll-reveal for a free-canvas page. The published markup is fully
// visible by default; before the first paint this hides the [data-reveal]
// elements and then reveals each one as it scrolls into view. Because the hide
// is applied before paint and is instant (the transition only runs on the
// reveal step), above-the-fold elements never flash. Visitors with JavaScript
// disabled, or who prefer reduced motion, simply see everything.
export default function CanvasMotion() {
  useBeforePaint(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!els.length || !('IntersectionObserver' in window)) return

    els.forEach(el => el.classList.add('canvas-reveal-init'))
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          const delay = Math.max(0, Math.min(2000, Number(el.dataset.revealDelay) || 0))
          window.setTimeout(() => el.classList.add('canvas-reveal-in'), delay)
          io.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
