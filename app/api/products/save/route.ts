export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listSites, saveSiteContent } from '@/lib/sites/store'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getPages } from '@/lib/sites/types'
import type { SiteContent, SitePage, WorkbookProduct } from '@/lib/sites/types'
import { listOwnerProducts, buildLanding, productsToCardsHtml, spliceProductsRegion } from '@/lib/workbooks/products'

// Owner-only: save one product (interactive workbook OR downloadable file) — its title,
// kind, access mode (free / members / paid), price + reduced price, cover, description,
// and landing page. Writes the product's DB row (kind/access/tier/file) + the site content
// (pricing/cover/landing), regenerates the landing page + the Resources library cards.
// The interactive workbook HTML uploads separately via /api/workbooks/upload (it can be
// several MB); a download's file uploads to the site-resources bucket, and its path is
// passed in here.
function slugify(s: string): string {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }

  const title = String(body.title ?? '').trim().slice(0, 120)
  const rawSlug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(title)
  if (!title) return NextResponse.json({ error: 'Give it a title.' }, { status: 400 })
  if (!rawSlug) return NextResponse.json({ error: 'That title can’t be turned into a web address — add some letters.' }, { status: 400 })
  if (rawSlug === 'resources') return NextResponse.json({ error: 'That name is reserved — pick another.' }, { status: 400 })

  const kind: 'workbook' | 'download' = body.kind === 'download' ? 'download' : 'workbook'
  const access: 'free' | 'members' | 'paid' = body.access === 'free' || body.access === 'members' ? body.access : 'paid'
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.toLowerCase().slice(0, 10) : 'eur'

  // Price only applies when sold à la carte. A reduced price (if given) must be lower.
  let priceCents = 0
  let salePriceCents: number | undefined
  if (access === 'paid') {
    priceCents = Number(body.priceCents)
    if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 500000) {
      return NextResponse.json({ error: 'Enter a price between 1 and 5000.' }, { status: 400 })
    }
    if (body.salePriceCents != null && body.salePriceCents !== '') {
      const s = Number(body.salePriceCents)
      if (!Number.isInteger(s) || s < 100 || s >= priceCents) {
        return NextResponse.json({ error: 'The reduced price must be a number lower than the price.' }, { status: 400 })
      }
      salePriceCents = s
    }
  }

  // Members-only needs a tier that unlocks it.
  const tierId = access === 'members' ? (String(body.tierId ?? '').trim() || null) : null
  if (access === 'members' && !tierId) {
    return NextResponse.json({ error: 'Pick the membership that unlocks this.' }, { status: 400 })
  }

  const description = String(body.description ?? '').slice(0, 600)
  const tagline = String(body.tagline ?? '').slice(0, 200)
  const landingMode: 'form' | 'html' = body.landingMode === 'html' ? 'html' : 'form'
  const landingBody = String(body.landingBody ?? '').slice(0, 40000)
  const landingHtml = String(body.landingHtml ?? '').slice(0, 4000000)
  const hidden = !!body.hidden
  if (landingMode === 'html' && !landingHtml.trim()) {
    return NextResponse.json({ error: 'Paste your landing HTML, or switch to the simple page.' }, { status: 400 })
  }
  // cover: a data URL to set, '' to remove, or absent to keep the previous one.
  let cover: string | undefined
  if (typeof body.coverImage === 'string') {
    cover = body.coverImage === '' ? '' : (body.coverImage.startsWith('data:image/') ? body.coverImage.slice(0, 4000000) : undefined)
  }
  // download file: the storage path (from a prior signed upload). Absent = keep existing.
  const filePath = typeof body.filePath === 'string' && body.filePath.trim() ? body.filePath.trim().slice(0, 400) : undefined
  const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : undefined
  const fileSize = Number.isInteger(body.fileSize as number) ? (body.fileSize as number) : undefined
  const mime = typeof body.mime === 'string' ? body.mime.slice(0, 100) : undefined

  // Resolve the owner's public site.
  const sites = await listSites().catch(() => null)
  if (!sites) return NextResponse.json({ error: 'Could not load your site.' }, { status: 500 })
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]
  if (!site) return NextResponse.json({ error: 'No website found on your account.' }, { status: 404 })
  const base = (site.content || {}) as SiteContent

  // Collision guard: a product "owns" a slug only if it's already a product in content;
  // reject a new slug that's another page (contact, about, a designed page…).
  const ownsSlug = !!(base.workbookProducts && base.workbookProducts[rawSlug])
  const existingPage = getPages(base).find(p => p.slug === rawSlug)
  if (existingPage && !ownsSlug) {
    const isDesigned = !existingPage.fullHtml && (
      (!!existingPage.canvas && Array.isArray(existingPage.canvas.elements) && existingPage.canvas.elements.length > 0) ||
      (Array.isArray(existingPage.sections) && existingPage.sections.length > 0)
    )
    return NextResponse.json({
      error: isDesigned
        ? 'That web address is a page you built in the editor — give it a different title.'
        : 'A page with that web address already exists — give it a different title.',
    }, { status: 400 })
  }

  // Write the product's DB row (the gating source of truth). Only touch what's provided so
  // an HTML upload / edit never clobbers other columns. RLS scopes it to the owner.
  const sb = createSupabaseServerClient()
  const row: Record<string, unknown> = {
    owner_id: user.id, slug: rawSlug, title, kind, access, tier_id: tierId, hidden, updated_at: new Date().toISOString(),
  }
  if (kind === 'download') {
    row.html_content = null // it's a file now — never keep/serve stale workbook HTML
    if (filePath !== undefined) {
      row.file_path = filePath
      row.file_name = fileName ?? null
      row.file_size = fileSize ?? null
      row.mime = mime ?? null
    }
  } else {
    // interactive workbook: clear any stale download file (the HTML is uploaded separately + untouched here)
    row.file_path = null; row.file_name = null; row.file_size = null; row.mime = null
  }
  const { error: upErr } = await sb.from('workbooks').upsert(row, { onConflict: 'owner_id,slug' })
  if (upErr) {
    const code = (upErr as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205' || code === '42703') {
      return NextResponse.json({ error: 'The products table isn’t upgraded yet. Run migration 025 in Supabase.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Save failed: ' + upErr.message }, { status: 500 })
  }

  // Upsert the content metadata (pricing/cover/landing + a mirror of kind/access).
  const wp = { ...(base.workbookProducts || {}) } as Record<string, WorkbookProduct>
  const prev = wp[rawSlug] || ({} as WorkbookProduct)
  wp[rawSlug] = {
    ...prev,
    kind, access, tierId: tierId || undefined,
    title, priceCents, salePriceCents, currency, description, tagline,
    coverImage: cover === undefined ? (prev.coverImage || '') : cover,
    landingMode, landingBody, landingHtml,
    order: Number.isFinite(prev.order as number) ? (prev.order as number) : Object.keys(wp).length,
    hidden,
  }

  // Build the merged product view (kind/access/file/hasContent) with the new metadata.
  const { products, workbooksOk } = await listOwnerProducts(user.id, { ...base, workbookProducts: wp })
  const thisProduct = products.find(p => p.slug === rawSlug)
  if (!thisProduct) return NextResponse.json({ error: 'Could not build the item.' }, { status: 500 })

  const brand = base.brand || 'Anima Temple'
  const pages = getPages(base).slice()

  // Landing page (create or update).
  const landing = buildLanding(thisProduct, { siteSlug: site.slug, brand })
  const seo = { seoTitle: `${title} · ${brand}`, seoDescription: description.slice(0, 300) }
  const idx = pages.findIndex(p => p.slug === rawSlug)
  if (idx >= 0) {
    const np: SitePage = { ...pages[idx], title, fullHtml: landing, offline: false, ...seo }
    delete np.canvas
    pages[idx] = np
  } else {
    pages.push({ id: `pg-${rawSlug}-${pages.length + 1}`, slug: rawSlug, title, headline: '', subheadline: '', sections: [], fullHtml: landing, ...seo } as SitePage)
  }

  // Regenerate the Resources library cards (only when the product read was complete + markers present).
  const resIdx = pages.findIndex(p => p.slug === 'resources')
  let cardsUpdated = false
  if (workbooksOk && resIdx >= 0 && pages[resIdx].fullHtml) {
    const spliced = spliceProductsRegion(pages[resIdx].fullHtml as string, productsToCardsHtml(products))
    if (spliced.ok) { pages[resIdx] = { ...pages[resIdx], fullHtml: spliced.html }; cardsUpdated = true }
  }

  // Mirror Tuned In's price into the legacy keys the buy route still falls back to.
  const legacy: Partial<SiteContent> = rawSlug === 'tuned-in'
    ? { workbookPriceCents: priceCents, workbookCurrency: currency, workbookTitle: title }
    : {}

  try {
    await saveSiteContent(site.id, { ...base, ...legacy, pages, workbookProducts: wp })
  } catch (e) {
    return NextResponse.json({ error: 'Save failed: ' + String((e as Error)?.message || e) }, { status: 500 })
  }
  return NextResponse.json({ ok: true, slug: rawSlug, cardsUpdated })
}
