'use client'

import { useRef } from 'react'
import { addPageAction } from '../../actions'

type Page = { id: string; slug: string; navLabel?: string; title?: string; hidden?: boolean }

// The top "Pages" tabs + "+ Add" form. Split out of page.tsx so navigating between
// pages first flushes the canvas editor's unsaved work via window.__cvFlush — switching
// pages can never lose edits. On a block page __cvFlush is undefined and the optional
// chaining no-ops, so navigation behaves exactly as before.
export default function PageTabs({
  siteId,
  pages,
  currentSlug,
  newCanvas,
}: {
  siteId: string
  pages: Page[]
  currentSlug: string
  newCanvas: string
}) {
  const current = pages.find(p => p.slug === currentSlug) ?? pages[0]
  // requestSubmit() below re-dispatches a submit event that React also handles, so
  // this guard lets the second (re-entrant) pass through to the server action instead
  // of preventDefault-ing forever.
  const submitting = useRef(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mr-1">Pages</span>
      {pages.map(p => (
        <a
          key={p.id}
          href={`/sites/${siteId}/design?page=${p.slug}`}
          onClick={async e => {
            e.preventDefault()
            await (window as unknown as { __cvFlush?: () => Promise<void> }).__cvFlush?.()
            window.location.href = `/sites/${siteId}/design?page=${p.slug}`
          }}
          className={`font-label text-[10px] tracking-[2px] uppercase px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
            p.slug === current.slug ? 'bg-gold text-background' : 'border border-gold/20 text-ash hover:text-gold'
          }`}
        >
          {p.navLabel || p.title || 'Untitled'}
          {p.hidden && <span className="opacity-50"> · hidden</span>}
        </a>
      ))}
      <form
        action={addPageAction}
        onSubmit={async e => {
          // The requestSubmit() below re-enters this handler; on that pass, let the
          // server action (addPageAction) run — do NOT preventDefault again.
          if (submitting.current) { submitting.current = false; return }
          e.preventDefault()
          submitting.current = true
          const form = e.currentTarget // capture before the await — React nulls currentTarget after
          await (window as unknown as { __cvFlush?: () => Promise<void> }).__cvFlush?.()
          form.requestSubmit()
        }}
        className="flex items-center gap-1"
      >
        <input type="hidden" name="id" value={siteId} />
        {/* Inherit the current build mode: a new page added from a canvas page is a canvas page. */}
        <input type="hidden" name="canvas" value={newCanvas} />
        <input
          name="title"
          placeholder="New page name"
          className="bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-xs px-3 py-1.5 rounded-sm outline-none placeholder:text-ash/40"
          style={{ width: 130 }}
        />
        <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">
          + Add
        </button>
      </form>
    </div>
  )
}
