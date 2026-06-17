'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_SAVED_DESIGNS } from '@/lib/sites/types'
import { saveDesignAction, loadDesignAction, deleteDesignAction, renameDesignAction } from '../actions'

type Slot = { id: string; name: string; savedAt: string }

function when(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function SavedDesigns({ siteId, designs }: { siteId: string; designs: Slot[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState<string>('') // id (or 'new') currently acting
  const [msg, setMsg] = useState<string>('')

  const canSaveNew = designs.length < MAX_SAVED_DESIGNS

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    setBusy(key)
    setMsg('')
    start(async () => {
      try {
        const r = await fn()
        if (!r.ok) {
          setMsg(r.error === 'full' ? `You can keep up to ${MAX_SAVED_DESIGNS} designs — delete one first.` : 'Something went wrong — please try again.')
          return
        }
        if (okMsg) setMsg(okMsg)
        router.refresh()
      } catch {
        setMsg('Couldn’t reach the server — your design was not changed. Please try again.')
      } finally {
        setBusy('')
      }
    })
  }

  const saveNew = () => {
    run('new', () => saveDesignAction(siteId, newName), 'Saved ✓')
    setNewName('')
  }
  const update = (s: Slot) => {
    if (!confirm(`Overwrite “${s.name}” with your current design? What was saved in this slot will be replaced.`)) return
    run(s.id, () => saveDesignAction(siteId, s.name, s.id), 'Updated ✓')
  }
  const load = (s: Slot) => {
    if (!confirm(`Switch to “${s.name}”?\n\nThis replaces your current working design with this saved one. If you want to keep what you have now, save it to a slot first.`)) return
    run(s.id, () => loadDesignAction(siteId, s.id), `Switched to “${s.name}” ✓`)
  }
  const rename = (s: Slot) => {
    const name = prompt('Rename this design', s.name)
    if (name === null) return
    run(s.id, () => renameDesignAction(siteId, s.id, name).then(r => ({ ok: r.ok })))
  }
  const remove = (s: Slot) => {
    if (!confirm(`Delete the saved design “${s.name}”? This can’t be undone (your current working design is not affected).`)) return
    run(s.id, () => deleteDesignAction(siteId, s.id).then(r => ({ ok: r.ok })), 'Deleted')
  }

  return (
    <section className="border border-gold/15 rounded-sm p-6">
      <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">Saved designs</p>
      <p className="font-body text-ash/60 text-xs mb-5">
        Keep up to {MAX_SAVED_DESIGNS} different looks for this site and switch between them anytime. Save your current design to a slot, then experiment freely — you can always come back to it.
      </p>

      {designs.length > 0 ? (
        <div className="space-y-2 mb-5">
          {designs.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-gold/10 rounded-sm px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-body text-parchment text-sm truncate">{s.name}</p>
                <p className="font-label text-[9px] tracking-[2px] uppercase text-ash/50 mt-0.5">Saved {when(s.savedAt)}</p>
              </div>
              <button type="button" disabled={pending} onClick={() => load(s)} className="font-label text-[9px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-2 rounded-sm disabled:opacity-50">
                {busy === s.id && pending ? '…' : 'Switch to this'}
              </button>
              <button type="button" disabled={pending} onClick={() => update(s)} title="Overwrite this slot with your current design" className="font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm disabled:opacity-50">
                Update
              </button>
              <button type="button" disabled={pending} onClick={() => rename(s)} className="font-label text-[9px] tracking-[2px] uppercase text-ash/60 hover:text-gold px-2 py-2 disabled:opacity-50">
                Rename
              </button>
              <button type="button" disabled={pending} onClick={() => remove(s)} className="font-label text-[9px] tracking-[2px] uppercase text-red-400/80 hover:text-red-300 px-2 py-2 disabled:opacity-50">
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-body text-ash/40 text-xs mb-5">No saved designs yet.</p>
      )}

      {canSaveNew ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveNew() }}
            placeholder={`e.g. “Original”, “Summer look”…`}
            maxLength={40}
            className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
          />
          <button type="button" disabled={pending} onClick={saveNew} className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm disabled:opacity-50">
            {busy === 'new' && pending ? 'Saving…' : '+ Save current design'}
          </button>
        </div>
      ) : (
        <p className="font-body text-ash/50 text-xs">You’ve filled all {MAX_SAVED_DESIGNS} slots. Update or delete one to save another.</p>
      )}

      {msg && <p className="font-body text-xs mt-3" style={{ color: msg.includes('wrong') || msg.includes('delete one') ? '#f87171' : '#9a7d2e' }}>{msg}</p>}
    </section>
  )
}
