'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// A clickable PREVIEW of the hosting experience. It uses the browser's local
// storage instead of a real database/engine, so it works with zero setup —
// a tangible taste of the product. The real version swaps this store for
// Supabase and the simulated deploy for the Coolify engine; the UI stays.

type Status = 'building' | 'live'
interface Site {
  id: string
  name: string
  slug: string
  template: string
  status: Status
  createdAt: number
}

const STORAGE_KEY = 'ht_preview_sites'
const TEMPLATES = ['Coming soon page', 'Portfolio', 'Business site', 'Blog', 'Blank']

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'site'
  )
}

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `s_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  }
}

export default function PreviewPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(TEMPLATES[0])
  const [loaded, setLoaded] = useState(false)

  // Load once on mount; any site left "building" from a previous visit is
  // treated as finished.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed: Site[] = raw ? JSON.parse(raw) : []
      setSites(parsed.map(s => (s.status === 'building' ? { ...s, status: 'live' } : s)))
    } catch {
      setSites([])
    }
    setLoaded(true)
  }, [])

  // Persist on every change.
  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(sites))
  }, [sites, loaded])

  function addSite(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const id = newId()
    const site: Site = {
      id,
      name: trimmed,
      slug: slugify(trimmed),
      template,
      status: 'building',
      createdAt: Date.now(),
    }
    setSites(prev => [site, ...prev])
    setName('')
    // Simulate a deploy finishing.
    setTimeout(() => {
      setSites(prev => prev.map(s => (s.id === id ? { ...s, status: 'live' } : s)))
    }, 2600)
  }

  function redeploy(id: string) {
    setSites(prev => prev.map(s => (s.id === id ? { ...s, status: 'building' } : s)))
    setTimeout(() => {
      setSites(prev => prev.map(s => (s.id === id ? { ...s, status: 'live' } : s)))
    }, 2200)
  }

  function remove(id: string) {
    setSites(prev => prev.filter(s => s.id !== id))
  }

  return (
    <main className="bg-background min-h-screen text-parchment">
      <header className="border-b border-gold/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-label text-[11px] tracking-[4px] uppercase text-gold">Anima&nbsp;Temple</span>
            <span className="font-label text-[9px] tracking-[2px] uppercase text-background bg-gold/80 px-2 py-0.5 rounded-sm">Preview</span>
          </div>
          <Link href="/" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">← Home</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        <section>
          <h1 className="font-display text-4xl italic text-parchment">Your websites</h1>
          <p className="font-body text-ash mt-2 text-sm">
            A working taste of the real thing. Add a website below and watch it go live. Everything
            here is saved only in your own browser — nothing is published yet.
          </p>
        </section>

        {/* Add a website */}
        <section className="border border-gold/15 rounded-sm p-6">
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-4">Add a website</p>
          <form onSubmit={addSite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My beautiful website"
              className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
            />
            <select
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none"
            >
              {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="submit"
              disabled={!name.trim()}
              className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight transition-colors px-6 py-3 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create →
            </button>
          </form>
        </section>

        {/* Sites */}
        <section className="space-y-3">
          {loaded && sites.length === 0 && (
            <div className="border border-gold/10 rounded-sm p-10 text-center">
              <p className="font-body text-ash">No websites yet — create your first one above.</p>
            </div>
          )}

          {sites.map(site => (
            <div key={site.id} className="border border-gold/15 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <p className="font-body text-parchment text-lg">{site.name}</p>
                  {site.status === 'building' ? (
                    <span className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-gold">
                      <span className="w-2 h-2 rounded-full bg-gold animate-pulse-gold" /> Building…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-400" /> Live
                    </span>
                  )}
                </div>
                <p className="font-body text-ash/60 text-sm mt-1">
                  {site.slug}.hostingthingy.app · <span className="text-gold/60">{site.template}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => redeploy(site.id)}
                  disabled={site.status === 'building'}
                  className="font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm transition-colors disabled:opacity-40"
                >
                  Redeploy
                </button>
                <button
                  onClick={() => remove(site.id)}
                  className="font-label text-[9px] tracking-[2px] uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </section>

        <p className="font-body text-ash/40 text-xs text-center pt-4">
          This is a preview. Real hosting (live domains, HTTPS, deploys) connects to the engine in a
          later step.
        </p>
      </div>
    </main>
  )
}
