'use client'

import { useEffect, useState, type ReactNode } from 'react'

// Wraps the top "Pages & menu" bar (page tabs + settings + menu links). On a free-canvas
// page it stays HIDDEN until the owner clicks the editor's "Pages" tab — the CanvasEditor
// announces that tab via a `cvpagespanel` window event (+ a `__cvPagesOpen` flag for the
// initial state) — so the editor chrome isn't cluttered. On a block page there's no Pages
// tab to reveal it, so it always shows (toggleable = false).
export default function PagesPanelBar({ toggleable, children }: { toggleable: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!toggleable)
  useEffect(() => {
    if (!toggleable) return
    // Pick up the current state in case the editor announced it before this mounted.
    try { if ((window as unknown as { __cvPagesOpen?: boolean }).__cvPagesOpen) setOpen(true) } catch { /* ignore */ }
    const onEvt = (e: Event) => setOpen(!!(e as CustomEvent).detail?.open)
    window.addEventListener('cvpagespanel', onEvt as EventListener)
    return () => window.removeEventListener('cvpagespanel', onEvt as EventListener)
  }, [toggleable])
  // Keep the children mounted (display:none) so any in-progress edit (e.g. a menu-link field)
  // isn't lost when the bar hides.
  return <div style={{ display: open ? undefined : 'none' }}>{children}</div>
}
