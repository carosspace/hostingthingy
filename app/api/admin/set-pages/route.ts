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
    pages?: { slug: string; title?: string; navLabel?: string; fullHtml?: string; canvas?: unknown; hideChrome?: boolean; hidden?: boolean; offline?: boolean; seoTitle?: string; seoDescription?: string; seoImage?: string }[]
    fontSystem?: string
    contactEmail?: string
    accentColor?: string
    pageBg?: string
    theme?: string
    brand?: string
    footer?: string
    navLinks?: { label: string; href: string; newTab?: boolean }[]
    workbookPriceCents?: number
    workbookCurrency?: string
    workbookTitle?: string
    workbookHtml?: string
    workbookSlug?: string
    workbookProducts?: Record<string, { priceCents?: number; currency?: string; title?: string }>
    seoTitle?: string
    seoDescription?: string
    seoImage?: string
    faviconImage?: string
    logoImage?: string
    socials?: { kind: string; url: string }[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  try {
    const { data: site, error: e1 } = await admin.from('sites').select('id, owner_id, content').eq('slug', 'animatemple-com').single()
    if (e1 || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    // --- interactive workbook content: `workbooks` table, keyed by (owner, slug) so an
    // owner can hold more than one (Tuned In, Meeting Yourself, …). Update in place if the
    // product row exists (keeps title/tier), else insert. ---
    if (typeof body.workbookHtml === 'string' && body.workbookHtml.trim().length > 100) {
      if (body.workbookHtml.length > 8_000_000) return NextResponse.json({ error: 'workbook too large (max ~8MB)' }, { status: 400 })
      const ownerId = (site as { owner_id: string }).owner_id
      const rawSlug = (typeof body.workbookSlug === 'string' && body.workbookSlug.trim()) ? body.workbookSlug.trim().toLowerCase() : 'tuned-in'
      if (!/^[a-z0-9-]{1,60}$/.test(rawSlug)) return NextResponse.json({ error: 'bad workbookSlug' }, { status: 400 })
      const title = (typeof body.workbookTitle === 'string' && body.workbookTitle.trim())
        ? body.workbookTitle.trim().slice(0, 120)
        : (rawSlug === 'tuned-in' ? 'Tuned In' : 'Workbook')
      const stamp = new Date().toISOString()
      const { data: exist } = await admin.from('workbooks').select('slug').eq('owner_id', ownerId).eq('slug', rawSlug).maybeSingle()
      if (exist) {
        // Only overwrite the title when one was explicitly provided.
        const upd: Record<string, unknown> = { html_content: body.workbookHtml, updated_at: stamp }
        if (typeof body.workbookTitle === 'string' && body.workbookTitle.trim()) upd.title = title
        const { error: ew } = await admin.from('workbooks').update(upd).eq('owner_id', ownerId).eq('slug', rawSlug)
        if (ew) return NextResponse.json({ error: 'workbook: ' + ew.message }, { status: 500 })
      } else {
        const { error: ew } = await admin.from('workbooks').insert({ owner_id: ownerId, slug: rawSlug, title, html_content: body.workbookHtml, updated_at: stamp })
        if (ew) return NextResponse.json({ error: 'workbook: ' + ew.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, workbook: exist ? 'updated' : 'created', slug: rawSlug, bytes: body.workbookHtml.length })
    }

    const content = (site.content || {}) as Record<string, unknown>

    // --- site-level config (only set the keys that were provided) ---
    if (typeof body.fontSystem === 'string') content.fontSystem = body.fontSystem
    if (typeof body.contactEmail === 'string') content.contactEmail = body.contactEmail
    if (typeof body.accentColor === 'string') content.accentColor = body.accentColor
    if (typeof body.pageBg === 'string') content.pageBg = body.pageBg
    if (typeof body.theme === 'string') content.theme = body.theme
    if (typeof body.brand === 'string') content.brand = body.brand
    if (typeof body.footer === 'string') content.footer = body.footer
    if (Number.isInteger(body.workbookPriceCents)) content.workbookPriceCents = body.workbookPriceCents
    if (typeof body.workbookCurrency === 'string') content.workbookCurrency = body.workbookCurrency
    if (typeof body.workbookTitle === 'string') content.workbookTitle = body.workbookTitle
    // Per-product buy config for extra workbooks: content.workbookProducts[slug] =
    // { priceCents, currency, title }. Merged (not replaced) so each call can add one.
    if (body.workbookProducts && typeof body.workbookProducts === 'object') {
      const existing = (content.workbookProducts && typeof content.workbookProducts === 'object' ? content.workbookProducts : {}) as Record<string, unknown>
      for (const [k, v] of Object.entries(body.workbookProducts)) {
        if (!/^[a-z0-9-]{1,60}$/.test(k) || !v || typeof v !== 'object') continue
        const cur = (existing[k] && typeof existing[k] === 'object' ? existing[k] : {}) as Record<string, unknown>
        if (Number.isInteger(v.priceCents)) cur.priceCents = v.priceCents
        if (typeof v.currency === 'string') cur.currency = v.currency.slice(0, 10)
        if (typeof v.title === 'string') cur.title = v.title.slice(0, 120)
        existing[k] = cur
      }
      content.workbookProducts = existing
    }
    if (typeof body.seoTitle === 'string') content.seoTitle = body.seoTitle
    if (typeof body.seoDescription === 'string') content.seoDescription = body.seoDescription
    if (typeof body.seoImage === 'string') content.seoImage = body.seoImage
    if (typeof body.faviconImage === 'string') content.faviconImage = body.faviconImage
    if (typeof body.logoImage === 'string') content.logoImage = body.logoImage
    if (Array.isArray(body.socials)) {
      content.socials = body.socials
        .filter(s => s && typeof s.kind === 'string' && typeof s.url === 'string')
        .map(s => ({ kind: String(s.kind).slice(0, 20), url: String(s.url).slice(0, 400) }))
    }
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
      if (!hasCanvas && !html && inc.hidden === undefined && inc.offline === undefined && inc.navLabel === undefined && inc.hideChrome === undefined && inc.seoTitle === undefined && inc.seoDescription === undefined && inc.seoImage === undefined) continue

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
      if (inc.seoTitle !== undefined) target.seoTitle = inc.seoTitle
      if (inc.seoDescription !== undefined) target.seoDescription = inc.seoDescription
      if (inc.seoImage !== undefined) target.seoImage = inc.seoImage

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
