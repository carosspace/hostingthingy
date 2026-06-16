'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// useLayoutEffect on the client, a no-op useEffect during SSR (silences the warning).
const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Fades + slides its children in the first time they scroll into view.
//
// Progressive enhancement: the server renders the content fully VISIBLE, so if
// JavaScript is disabled or never finishes loading the section is simply shown —
// it is never left blank. Only once JS mounts do we (in a layout effect, before
// the browser paints) switch to the hidden state and watch for the element to
// scroll into view. Because the hide happens before paint, sections below the
// fold never flash; an above-the-fold section briefly hides then fades in, which
// is the intended reveal animation anyway.
export default function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [armed, setArmed] = useState(false) // JS has taken over; we will animate
  const [shown, setShown] = useState(false) // element has scrolled into view

  useBeforePaint(() => {
    const el = ref.current
    if (!el) return
    // Respect users who prefer reduced motion — leave content visible, no animation.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setArmed(true)
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        })
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const hidden = armed && !shown
  return (
    <div
      ref={ref}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? 'translateY(28px)' : 'none',
        // Animate only the reveal (0 -> 1); the initial JS hide is instant.
        transition: shown ? 'opacity 0.7s ease, transform 0.7s ease' : undefined,
        willChange: armed ? 'opacity, transform' : undefined,
      }}
    >
      {children}
    </div>
  )
}
