'use client'

import { useState, useTransition } from 'react'
import type { StockPhoto } from '@/lib/sites/types'
import { searchStockPhotos } from '../../actions'

// A modal to search free stock photos (Pexels, via a server-side proxy) and pick
// one. onSelect receives the chosen photo's full-size CDN URL.
export default function StockPhotos({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [photos, setPhotos] = useState<StockPhoto[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [pending, start] = useTransition()

  const run = () => {
    const query = q.trim()
    if (!query) return
    setError('')
    start(async () => {
      const r = await searchStockPhotos(query)
      setSearched(true)
      if (!r.ok) {
        setPhotos([])
        setError(r.error === 'nokey' ? 'nokey' : 'failed')
        return
      }
      setPhotos(r.photos ?? [])
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="rounded-lg p-5 flex flex-col" style={{ background: '#faf7f2', width: 'min(680px, 94vw)', maxHeight: '88vh' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9a7d2e' }}>Stock photos</span>
          <button type="button" onClick={onClose} style={{ fontSize: 16, color: '#888', lineHeight: 1 }}>×</button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') run() }}
            autoFocus
            placeholder="Search free photos — e.g. yoga, candles, forest…"
            style={{ flex: 1, background: '#fff', color: '#222', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 5, fontSize: 14, padding: '9px 12px', outline: 'none' }}
          />
          <button type="button" onClick={run} disabled={pending} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', background: '#9a7d2e', color: '#faf7f2', padding: '0 16px', borderRadius: 5, opacity: pending ? 0.6 : 1 }}>{pending ? '…' : 'Search'}</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 120 }}>
          {error === 'nokey' ? (
            <p className="font-body" style={{ fontSize: 13, color: '#7a5c61', lineHeight: 1.6 }}>
              Stock-photo search needs a free Pexels API key. Grab one in a minute at <span style={{ color: '#9a7d2e' }}>pexels.com/api</span> and ask to have it added — then this lights up.
            </p>
          ) : error === 'failed' ? (
            <p className="font-body" style={{ fontSize: 13, color: '#b3402f' }}>Couldn’t reach the photo service — please try again.</p>
          ) : !searched ? (
            <p className="font-body text-ash/50" style={{ fontSize: 13 }}>Search for a subject to see free, ready-to-use photos.</p>
          ) : photos.length === 0 ? (
            <p className="font-body text-ash/50" style={{ fontSize: 13 }}>No photos found — try a different word.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {photos.map(p => (
                <button key={p.id} type="button" onClick={() => onSelect(p.url)} title={p.alt || `Photo by ${p.credit}`} style={{ position: 'relative', padding: 0, border: 'none', borderRadius: 5, overflow: 'hidden', cursor: 'pointer', aspectRatio: '1 / 1', background: '#eee' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="font-body text-ash/40" style={{ fontSize: 10, marginTop: 10 }}>Photos provided by Pexels — free to use.</p>
      </div>
    </div>
  )
}
