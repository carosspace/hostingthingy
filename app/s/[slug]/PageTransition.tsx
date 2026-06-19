'use client'
import { usePathname } from 'next/navigation'
import type { PageTransitionKind } from '@/lib/sites/types'

// Wraps the published page's main content in a gentle enter animation that replays on
// every navigation (the key changes with the path, forcing a re-mount so the CSS
// animation runs again). When the site has no transition set, it renders children
// unchanged — no extra wrapper, no layout impact. Reduced-motion users get nothing
// (the keyframes are disabled in globals.css).
export function PageTransition({ kind, children }: { kind?: PageTransitionKind; children: React.ReactNode }) {
  const pathname = usePathname()
  if (!kind || kind === 'none') return <>{children}</>
  return (
    <div key={pathname} className={`flex-1 flex flex-col cv-pt-${kind}`}>
      {children}
    </div>
  )
}
