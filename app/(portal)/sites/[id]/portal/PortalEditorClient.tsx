'use client'

import { useState, type CSSProperties } from 'react'
import type { MemberPortalConfig } from '@/lib/sites/types'
import {
  PORTAL_TILE_DEFAULTS,
  TILE_ORDER,
  DEFAULT_WELCOME,
  DEFAULT_EMPTY,
  fillTokens,
} from '@/lib/portal/defaults'
import { savePortalConfigAction } from '../../actions'

type ModuleKey = 'blueprint' | 'bookings' | 'messages' | 'courses' | 'memberships' | 'resources'
type TileKey = (typeof TILE_ORDER)[number]

const MODULE_LABELS: Record<ModuleKey, string> = {
  blueprint: 'Divine Blueprint',
  bookings: 'Bookings',
  messages: 'Messages',
  courses: 'Courses',
  memberships: 'Memberships',
  resources: 'Resources',
}
const MODULE_ORDER: ModuleKey[] = ['blueprint', 'bookings', 'messages', 'courses', 'memberships', 'resources']

// A sample client, so the preview shows the greeting + tiles in action.
const SAMPLE_NAME = 'Sarah'
const SAMPLE_EMAIL = 'sarah@example.com'

export default function PortalEditorClient({
  siteId,
  brand,
  baseAccent,
  rootStyle,
  portalText,
  portalMuted,
  initial,
}: {
  siteId: string
  brand: string
  baseAccent: string
  rootStyle: CSSProperties
  portalText: string
  portalMuted: string
  initial: MemberPortalConfig
}) {
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(() => ({
    blueprint: initial.modules?.blueprint !== false,
    bookings: initial.modules?.bookings !== false,
    messages: initial.modules?.messages !== false,
    courses: initial.modules?.courses !== false,
    memberships: initial.modules?.memberships !== false,
    resources: initial.modules?.resources !== false,
  }))
  const [welcome, setWelcome] = useState(initial.welcome ?? '')
  const [emptyState, setEmptyState] = useState(initial.emptyState ?? '')
  const [accent, setAccent] = useState(initial.accent ?? '') // '' = inherit the site accent
  const [tiles, setTiles] = useState<Record<TileKey, { title: string; desc: string }>>(() => {
    const out = {} as Record<TileKey, { title: string; desc: string }>
    for (const k of TILE_ORDER) out[k] = { title: initial.tiles?.[k]?.title ?? '', desc: initial.tiles?.[k]?.desc ?? '' }
    return out
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const eff = accent || baseAccent // the accent the preview actually paints with

  function buildConfig(): MemberPortalConfig {
    const t: NonNullable<MemberPortalConfig['tiles']> = {}
    for (const k of TILE_ORDER) {
      const title = tiles[k].title.trim()
      const desc = tiles[k].desc.trim()
      if (title || desc) t[k] = { title: title || undefined, desc: desc || undefined }
    }
    return {
      modules,
      welcome: welcome.trim() || undefined,
      tiles: Object.keys(t).length ? t : undefined,
      emptyState: emptyState.trim() || undefined,
      accent: accent || undefined,
    }
  }

  async function onSave() {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await savePortalConfigAction(siteId, buildConfig())
      setStatus(res.ok ? 'saved' : 'error')
    } catch {
      setStatus('error')
    }
    setSaving(false)
  }

  // --- Resolved preview copy -------------------------------------------------
  const welcomeText = fillTokens(welcome.trim() || DEFAULT_WELCOME, SAMPLE_NAME, brand)
  const emptyText = fillTokens(emptyState.trim() || DEFAULT_EMPTY, SAMPLE_NAME, brand)
  const enabledTiles = TILE_ORDER.filter(k => modules[k])
  const quick: { label: string; icon: string }[] = []
  if (modules.messages) quick.push({ label: 'Messages', icon: '✉' })
  if (modules.bookings) quick.push({ label: 'Book a session', icon: '◷' })

  function tileCopy(k: TileKey) {
    const d = PORTAL_TILE_DEFAULTS[k]
    return {
      icon: d.icon,
      title: fillTokens(tiles[k].title.trim() || d.title, SAMPLE_NAME, brand),
      desc: fillTokens(tiles[k].desc.trim() || d.desc, SAMPLE_NAME, brand),
    }
  }

  // --- Shared control styling ------------------------------------------------
  const labelCls = 'font-label text-[10px] tracking-[2px] uppercase text-ash/50 block mb-1.5'
  const inputCls =
    'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40'
  const cardCls = 'border border-gold/15 rounded-sm p-5'
  const previewCard: CSSProperties = { background: `${eff}0a`, border: `1px solid ${eff}26`, borderRadius: 18 }
  const previewQuick: CSSProperties = { background: `${eff}12`, border: `1px solid ${eff}2e`, borderRadius: 999 }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* -------------------------------- CONTROLS -------------------------------- */}
      <div className="space-y-5">
        {/* Modules */}
        <div className={cardCls}>
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-1">Rooms</p>
          <p className="font-body text-ash/50 text-xs mb-4">
            Turn whole rooms on or off. An on room appears for a client only once they actually have something in it.
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
            {MODULE_ORDER.map(k => (
              <label key={k} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modules[k]}
                  onChange={e => setModules(m => ({ ...m, [k]: e.target.checked }))}
                  className="accent-gold w-4 h-4"
                />
                <span className="font-body text-parchment text-sm">{MODULE_LABELS[k]}</span>
              </label>
            ))}
          </div>
          <p className="font-body text-ash/40 text-[11px] mt-3">
            Messages and “Book a session” show as small always-there icons whenever those rooms are on.
          </p>
        </div>

        {/* Welcome */}
        <div className={cardCls}>
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-3">Welcome</p>
          <label className={labelCls}>Welcome message</label>
          <textarea
            value={welcome}
            onChange={e => setWelcome(e.target.value)}
            maxLength={600}
            rows={4}
            placeholder={DEFAULT_WELCOME}
            className={inputCls + ' resize-none'}
          />
          <p className="font-body text-ash/40 text-[11px] mt-1.5">
            Use {'{name}'} for the person’s name and {'{brand}'} for your brand. Leave blank for the default.
          </p>
        </div>

        {/* Tile wording */}
        <div className={cardCls}>
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-1">Room wording</p>
          <p className="font-body text-ash/50 text-xs mb-4">Rename a room or change its description. Blank = the default.</p>
          <div className="space-y-4">
            {TILE_ORDER.map(k => (
              <div key={k} className={modules[k] ? '' : 'opacity-45'}>
                <p className="font-label text-[10px] tracking-[2px] uppercase text-ash/60 mb-1.5">
                  {PORTAL_TILE_DEFAULTS[k].icon} {MODULE_LABELS[k]}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={tiles[k].title}
                    onChange={e => setTiles(s => ({ ...s, [k]: { ...s[k], title: e.target.value } }))}
                    maxLength={80}
                    placeholder={PORTAL_TILE_DEFAULTS[k].title}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={tiles[k].desc}
                    onChange={e => setTiles(s => ({ ...s, [k]: { ...s[k], desc: e.target.value } }))}
                    maxLength={160}
                    placeholder={fillTokens(PORTAL_TILE_DEFAULTS[k].desc, SAMPLE_NAME, brand)}
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        <div className={cardCls}>
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-3">Empty welcome</p>
          <label className={labelCls}>What a brand-new client sees (before they own anything)</label>
          <textarea
            value={emptyState}
            onChange={e => setEmptyState(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder={DEFAULT_EMPTY}
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* Accent */}
        <div className={cardCls}>
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-3">Accent</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={eff}
              onChange={e => setAccent(e.target.value)}
              className="w-10 h-10 rounded-sm bg-transparent border border-gold/20 cursor-pointer"
              aria-label="Portal accent colour"
            />
            <span className="font-body text-ash/70 text-xs">
              {accent ? 'Custom portal accent' : 'Inheriting your site accent'}
            </span>
            {accent && (
              <button
                type="button"
                onClick={() => setAccent('')}
                className="font-label text-[10px] tracking-[2px] uppercase text-gold/70 hover:text-gold"
              >
                Reset
              </button>
            )}
          </div>
          <p className="font-body text-ash/40 text-[11px] mt-3">
            Background &amp; fonts always inherit your site’s look, so the portal stays on-brand.
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight disabled:opacity-50 px-6 py-3 rounded-sm transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {status === 'saved' && <span className="font-body text-sm" style={{ color: '#3f7d4f' }}>✓ Saved</span>}
          {status === 'error' && <span className="font-body text-sm text-red-400">Couldn’t save — try again.</span>}
        </div>
      </div>

      {/* -------------------------------- LIVE PREVIEW -------------------------------- */}
      <div className="lg:sticky lg:top-4">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-ash/50 mb-2">Live preview</p>
        <div className="rounded-lg overflow-hidden border border-gold/15">
          {/* faux address bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-gold/10">
            <span className="w-2.5 h-2.5 rounded-full bg-ash/30" />
            <span className="font-body text-ash/50 text-[11px] ml-2">app.animatemple.com/me</span>
          </div>
          {/* the portal home, faithfully */}
          <div style={{ ...rootStyle, maxHeight: 620, overflowY: 'auto' }}>
            <div className="px-6 py-10">
              <h1 className="font-display italic" style={{ color: portalText, fontSize: 30, lineHeight: 1.1 }}>
                Welcome, {SAMPLE_NAME}
              </h1>
              <p className="font-body mt-3" style={{ color: portalText, fontSize: 14.5, lineHeight: 1.7, maxWidth: 460 }}>
                {welcomeText}
              </p>
              <p className="font-body mt-2.5" style={{ color: portalMuted, fontSize: 11.5 }}>
                Signed in as <span style={{ color: portalText }}>{SAMPLE_EMAIL}</span>.
              </p>

              {quick.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {quick.map(q => (
                    <span key={q.label} className="flex items-center gap-2 px-3.5 py-2" style={previewQuick}>
                      <span aria-hidden="true" style={{ color: eff, fontSize: 14, lineHeight: 1 }}>{q.icon}</span>
                      <span className="font-label" style={{ fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase', color: portalText }}>
                        {q.label}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {enabledTiles.length > 0 ? (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {enabledTiles.map(k => {
                    const c = tileCopy(k)
                    return (
                      <div key={k} className="p-5 flex flex-col gap-2.5" style={previewCard}>
                        <div className="flex items-start justify-between gap-3">
                          <span aria-hidden="true" style={{ color: eff, fontSize: 20, lineHeight: 1 }}>{c.icon}</span>
                          <span aria-hidden="true" style={{ color: eff, fontSize: 16, lineHeight: 1 }}>→</span>
                        </div>
                        <div>
                          <h2 className="font-display" style={{ color: portalText, fontSize: 18, lineHeight: 1.2 }}>{c.title}</h2>
                          <p className="font-body mt-1" style={{ color: portalMuted, fontSize: 12, lineHeight: 1.55 }}>{c.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="font-body mt-8" style={{ color: portalMuted, fontSize: 14, lineHeight: 1.6, maxWidth: 420 }}>
                  {emptyText}
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="font-body text-ash/45 text-[11px] mt-2 leading-relaxed">
          Shown with a sample client. In the real portal each room appears only once that person actually has something in it;
          a brand-new client sees your welcome + the small icons.
        </p>
      </div>
    </div>
  )
}
