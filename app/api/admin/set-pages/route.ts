export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// TEMP (active site build): upsert pages onto the animatemple-com site + read/set a little
// site config. Token-gated. REMOVE when the site is finalised.
//
// POST body: {
//   fontSystem?, contactEmail?, accentColor?, pageBg?, theme?, brand?, footer?,   // optional site-level config
//   navLinks?: {label,href,newTab?}[],                                            // extra header nav links (e.g. Divine Blueprint)
//   pages?: { slug, title?, navLabel?, fullHtml?, canvas?, hideChrome?, hidden?, offline? }[]
// }
// A page with `canvas` becomes a free-canvas page (fullHtml cleared); a page with `fullHtml`
// becomes a full-page-HTML page (canvas cleared) — exactly one of the two per page.
const TOKEN = 'diag-7h3k9x2p'

function authed(req: NextRequest) {
  return req.headers.get('Authorization') === `Bearer ${TOKEN}`
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  const { data: site, error } = await admin.from('sites').select('content').eq('slug', 'animatemple-com').single()
  if (error || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 })
  const c = (site.content || {}) as Record<string, unknown>
  const pages = (Array.isArray(c.pages) ? c.pages : []) as Record<string, unknown>[]
  return NextResponse.json({
    brand: c.brand ?? null,
    theme: c.theme ?? null,
    accentColor: c.accentColor ?? null,
    pageBg: c.pageBg ?? null,
    fontSystem: c.fontSystem ?? null,
    contactEmail: c.contactEmail ?? null,
    footer: c.footer ?? null,
    layout: c.layout ?? null,
    navLinks: c.navLinks ?? null,
    menuPosition: c.menuPosition ?? null,
    pages: pages.map((p, i) => ({
      i,
      slug: p.slug ?? '',
      title: p.title ?? null,
      navLabel: p.navLabel ?? null,
      hidden: !!p.hidden,
      offline: !!p.offline,
      hideChrome: !!p.hideChrome,
      hasCanvas: !!(p.canvas && Array.isArray((p.canvas as Record<string, unknown>).elements) && ((p.canvas as { elements: unknown[] }).elements.length)),
      hasFullHtml: !!(p.fullHtml && String(p.fullHtml).trim()),
    })),
  })
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  let body: {
    pages?: { slug: string; title?: string; navLabel?: string; fullHtml?: string; canvas?: unknown; hideChrome?: boolean; hidden?: boolean; offline?: boolean }[]
    fontSystem?: string
    contactEmail?: string
    accentColor?: string
    pageBg?: string
    theme?: string
    brand?: string
    footer?: string
    navLinks?: { label: string; href: string; newTab?: boolean }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  try {
    const { data: site, error: e1 } = await admin.from('sites').select('id, content').eq('slug', 'animatemple-com').single()
    if (e1 || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    const content = (site.content || {}) as Record<string, unknown>

    // --- site-level config (only set the keys that were provided) ---
    if (typeof body.fontSystem === 'string') content.fontSystem = body.fontSystem
    if (typeof body.contactEmail === 'string') content.contactEmail = body.contactEmail
    if (typeof body.accentColor === 'string') content.accentColor = body.accentColor
    if (typeof body.pageBg === 'string') content.pageBg = body.pageBg
    if (typeof body.theme === 'string') content.theme = body.theme
    if (typeof body.brand === 'string') content.brand = body.brand
    if (typeof body.footer === 'string') content.footer = body.footer
    if (Array.isArray(body.navLinks)) {
      content.navLinks = body.navLinks
        .filter(l => l && typeof l.label === 'string' && typeof l.href === 'string')
        .map(l => ({ label: String(l.label).slice(0, 60), href: String(l.href).slice(0, 400), newTab: !!l.newTab }))
    }

    const pages = (Array.isArray(content.pages) ? content.pages : []) as Record<string, unknown>[]
    const results: string[] = []

    for (const inc of Array.isArray(body.pages) ? body.pages : []) {
      const slug = String(inc.slug ?? '')
      const hasCanvas = inc.canvas && typeof inc.canvas === 'object'
      const html = String(inc.fullHtml ?? '')
      if (!hasCanvas && !html && inc.hidden === undefined && inc.offline === undefined && inc.navLabel === undefined && inc.hideChrome === undefined) continue

      const existing = pages.find(p => String(p.slug ?? '') === slug)
      const target = existing ?? (() => {
        const np: Record<string, unknown> = { id: `pg-${slug || 'home'}-${pages.length + 1}`, slug, title: inc.title || slug || 'Page' }
        pages.push(np)
        return np
      })()

      if (inc.title) target.title = inc.title
      if (inc.navLabel !== undefined) target.navLabel = inc.navLabel
      if (inc.hideChrome !== undefined) target.hideChrome = !!inc.hideChrome
      if (inc.hidden !== undefined) target.hidden = !!inc.hidden
      if (inc.offline !== undefined) target.offline = !!inc.offline

      if (hasCanvas) {
        target.canvas = inc.canvas
        delete target.canvasHidden
        delete target.fullHtml
        if (inc.hidden === undefined) target.hidden = false
        if (inc.offline === undefined) target.offline = false
        results.push(`${existing ? 'updated' : 'created'}:canvas:${slug || 'home'}`)
      } else if (html) {
        target.fullHtml = html
        delete target.canvas
        delete target.canvasHidden
        if (inc.hidden === undefined) target.hidden = false
        if (inc.offline === undefined) target.offline = false
        results.push(`${existing ? 'updated' : 'created'}:html:${slug || 'home'}`)
      } else {
        results.push(`meta:${slug || 'home'}`)
      }
    }
    content.pages = pages

    const { error: e2 } = await admin.from('sites').update({ content, updated_at: new Date().toISOString() }).eq('id', site.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true, results, pageCount: pages.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
