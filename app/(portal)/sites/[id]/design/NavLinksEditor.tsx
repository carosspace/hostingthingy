'use client'

import { useState } from 'react'
import { setNavLinksAction } from '../../actions'
import type { NavLink } from '@/lib/sites/types'

const input =
  'bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40'

export default function NavLinksEditor({ siteId, initial }: { siteId: string; initial: NavLink[] }) {
  const [links, setLinks] = useState<NavLink[]>(initial)

  function add() {
    setLinks(l => [...l, { label: '', href: '', newTab: true }])
  }
  function update(i: number, patch: Partial<NavLink>) {
    setLinks(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }
  function remove(i: number) {
    setLinks(l => l.filter((_, j) => j !== i))
  }

  const clean = links.filter(l => l.label.trim() && l.href.trim())

  return (
    <details className="border border-gold/15 rounded-sm p-4">
      <summary className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 cursor-pointer">Extra menu links</summary>
      <p className="font-body text-ash/60 text-xs mt-3">
        Add buttons to your header like <span className="text-ash/80">Book now</span> or <span className="text-ash/80">Instagram</span>. Use a full
        web address (https://…), <code className="text-gold/70">/book/your-slug</code>, or <code className="text-gold/70">mailto:you@email.com</code>.
      </p>

      <form action={setNavLinksAction} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={siteId} />
        <input type="hidden" name="navLinks" value={JSON.stringify(clean)} />

        {links.length === 0 && <p className="font-body text-ash/40 text-sm">No extra links yet.</p>}

        {links.map((l, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2">
            <input
              value={l.label}
              onChange={e => update(i, { label: e.target.value })}
              placeholder="Label (e.g. Book now)"
              className={`${input} sm:w-40`}
            />
            <input
              value={l.href}
              onChange={e => update(i, { href: e.target.value })}
              placeholder="https://…  or  /book/your-slug"
              className={`${input} flex-1`}
            />
            <label className="flex items-center gap-1.5 font-body text-ash/60 text-xs whitespace-nowrap">
              <input type="checkbox" checked={l.newTab ?? false} onChange={e => update(i, { newTab: e.target.checked })} style={{ accentColor: '#a85c36' }} />
              new tab
            </label>
            <button type="button" onClick={() => remove(i)} className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300 px-1" aria-label="Remove link">
              ✕
            </button>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={add} className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">
            + Add link
          </button>
          <button type="submit" className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-1.5 rounded-sm">
            Save menu links
          </button>
        </div>
      </form>
    </details>
  )
}
