'use client'

import { useRef, useState } from 'react'
import { addPageAction, renamePageAction } from '../../actions'

type Page = { id: string; slug: string; navLabel?: string; title?: string; hidden?: boolean; offline?: boolean }

// The top "Pages" tabs + "+ Add" form. Click a tab to open that page; click its ✎ (or
// double-click the name) to rename it right there — no settings form, no reload. The rename
// saves in the background (renamePageAction does NOT revalidate) and the label updates
// optimistically, so the canvas editor never remounts / "jumps".
// Navigating between pages first flushes the canvas editor's unsaved work via window.__cvFlush.
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
  const submitting = useRef(false)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [localNames, setLocalNames] = useState<Record<string, string>>({})

  const nav = async (slug: string) => {
    await (window as unknown as { __cvFlush?: () => Promise<void> }).__cvFlush?.()
    window.location.href = `/sites/${siteId}/design?page=${slug}`
  }
  const labelOf = (p: Page) => localNames[p.slug] ?? p.navLabel ?? p.title ?? 'Untitled'
  const startEdit = (p: Page) => { setDraft(labelOf(p)); setEditingSlug(p.slug) }
  const commit = async (p: Page) => {
    const name = draft.trim()
    setEditingSlug(null)
    if (!name || name === labelOf(p)) return
    setLocalNames(m => ({ ...m, [p.slug]: name })) // show the new name instantly
    try { await renamePageAction({ id: siteId, slug: p.slug, name }) } catch {}
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mr-1">Pages</span>
      {pages.map(p => {
        const active = p.slug === current.slug
        const base = `font-label text-[10px] tracking-[2px] uppercase px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${active ? 'bg-gold text-background' : 'border border-gold/20 text-ash'}`
        if (editingSlug === p.slug) {
          return (
            <span key={p.id} className={base}>
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(p) } else if (e.key === 'Escape') setEditingSlug(null) }}
                onBlur={() => commit(p)}
                className={`bg-transparent outline-none border-b ${active ? 'border-background/50 text-background' : 'border-gold/50 text-parchment'}`}
                style={{ width: Math.max(70, draft.length * 8 + 16), font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
              />
            </span>
          )
        }
        return (
          <span key={p.id} className={base}>
            <span
              onClick={() => { if (!active) nav(p.slug) }}
              onDoubleClick={() => startEdit(p)}
              className={active ? 'cursor-default' : 'cursor-pointer hover:text-gold'}
              title={active ? 'Double-click to rename' : 'Open this page (double-click to rename)'}
            >
              {labelOf(p)}
              {p.hidden && <span className="opacity-50"> · hidden</span>}
              {p.offline && <span className="opacity-50"> · offline</span>}
            </span>
            <button
              type="button"
              title="Rename"
              onClick={e => { e.stopPropagation(); startEdit(p) }}
              className="opacity-40 hover:opacity-100 cursor-pointer"
              style={{ fontSize: 11, lineHeight: 1 }}
            >
              ✎
            </button>
          </span>
        )
      })}
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
