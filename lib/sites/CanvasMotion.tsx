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

  // Jump links: clicking an element with data-jump scrolls to the matching
  // [data-cv] target. Because desktop + phone are both in the DOM (one hidden by
  // CSS), we scroll to whichever copy is actually visible.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('[data-jump]') as HTMLElement | null
      if (!a) return
      const id = a.getAttribute('data-jump')
      if (!id) return
      const targets = Array.from(document.querySelectorAll<HTMLElement>(`[data-cv="${CSS.escape(id)}"]`))
      const target = targets.find(t => t.offsetParent !== null) || targets[0]
      if (!target) return
      e.preventDefault()
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Parallax: [data-parallax] elements drift as the page scrolls. We measure each
  // element's resting centre once (before applying any transform) so its own drift
  // never feeds back into the measurement.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'))
    if (!nodes.length) return
    const items = nodes.map(el => {
      const r = el.getBoundingClientRect()
      return { el, baseCenter: r.top + window.scrollY + r.height / 2, speed: Number(el.dataset.parallax) || 0 }
    })
    let raf = 0
    const apply = () => {
      raf = 0
      const mid = window.scrollY + window.innerHeight / 2
      for (const it of items) {
        const offset = (mid - it.baseCenter) * (it.speed * 0.06)
        it.el.style.transform = `translateY(${offset.toFixed(1)}px)`
      }
    }
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(apply) }
    apply()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
