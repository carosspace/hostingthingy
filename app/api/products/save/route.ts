export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { listSites, saveSiteContent } from '@/lib/sites/store'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getPages } from '@/lib/sites/types'
import type { SiteContent, SitePage, WorkbookProduct } from '@/lib/sites/types'
import { listOwnerProducts, buildLanding, productsToCardsHtml, spliceProductsRegion } from '@/lib/workbooks/products'

// Owner-only: save one book's metadata (price, cover, library copy) + its landing page.
// Regenerates the landing fullHtml (from the simple form, or the owner's own HTML made
// iframe-safe) and re-renders the Resources library cards. The interactive workbook HTML
// itself is uploaded separately via /api/workbooks/upload (it can be several MB).
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
  if (!title) return NextResponse.json({ error: 'Give the book a title.' }, { status: 400 })
  if (!rawSlug) return NextResponse.json({ error: 'That title can’t be turned into a web address — add some letters.' }, { status: 400 })
  if (rawSlug === 'resources') return NextResponse.json({ error: 'That name is reserved — pick another.' }, { status: 400 })

  const priceCents = Number(body.priceCents)
  if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 500000) {
    return NextResponse.json({ error: 'Enter a price between 1 and 5000.' }, { status: 400 })
  }
  const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.toLowerCase().slice(0, 10) : 'eur'
  const description = String(body.description ?? '').slice(0, 600)
  const tagline = String(body.tagline ?? '').slice(0, 200)
  const landingMode: 'form' | 'html' = body.landingMode === 'html' ? 'html' : 'form'
  const landingBody = String(body.landingBody ?? '').slice(0, 40000)
  const landingHtml = String(body.landingHtml ?? '').slice(0, 4000000)
  const hidden = !!body.hidden
  // cover: a data URL to set, '' to remove, or absent (undefined) to keep the previous one.
  let cover: string | undefined
  if (typeof body.coverImage === 'string') {
    cover = body.coverImage === '' ? '' : (body.coverImage.startsWith('data:image/') ? body.coverImage.slice(0, 4000000) : undefined)
  }
  if (landingMode === 'html' && !landingHtml.trim()) {
    return NextResponse.json({ error: 'Paste your landing HTML, or switch to the simple form.' }, { status: 400 })
  }

  // Resolve the owner's public site (the one the books are sold on).
  const sites = await listSites().catch(() => null)
  if (!sites) return NextResponse.json({ error: 'Could not load your site.' }, { status: 500 })
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]
  if (!site) return NextResponse.json({ error: 'No website found on your account.' }, { status: 404 })
  const base = (site.content || {}) as SiteContent

  // Guard against clobbering another page. A book "owns" a slug only if it's a real
  // product in content (workbookProducts) — NOT merely a row in the workbooks table,
  // which can hold an orphan from an earlier failed attempt. If a page already lives at
  // this address and this book doesn't own it, reject rather than overwrite it.
  const ownsSlug = !!(base.workbookProducts && base.workbookProducts[rawSlug])
  const existingPage = getPages(base).find(p => p.slug === rawSlug)
  if (existingPage && !ownsSlug) {
    const isDesigned = !existingPage.fullHtml && (
      (!!existingPage.canvas && Array.isArray(existingPage.canvas.elements) && existingPage.canvas.elements.length > 0) ||
      (Array.isArray(existingPage.sections) && existingPage.sections.length > 0)
    )
    return NextResponse.json({
      error: isDesigned
        ? 'That web address is a page you built in the editor — give the book a different title.'
        : 'A page with that web address already exists — give the book a different title.',
    }, { status: 400 })
  }

  // 1) upsert the product metadata.
  const wp = { ...(base.workbookProducts || {}) } as Record<string, WorkbookProduct>
  const prev = wp[rawSlug] || ({} as WorkbookProduct)
  wp[rawSlug] = {
    ...prev,
    title, priceCents, currency, description, tagline,
    coverImage: cover === undefined ? (prev.coverImage || '') : cover,
    landingMode, landingBody, landingHtml,
    order: Number.isFinite(prev.order as number) ? (prev.order as number) : Object.keys(wp).length,
    hidden,
  }

  // 2) build the merged product view (hasContent + fallbacks) with the new metadata applied.
  const { products, workbooksOk } = await listOwnerProducts(user.id, { ...base, workbookProducts: wp })
  const thisProduct = products.find(p => p.slug === rawSlug)
  if (!thisProduct) return NextResponse.json({ error: 'Could not build the book.' }, { status: 500 })

  const brand = base.brand || 'Anima Temple'
  const pages = getPages(base).slice()

  // 3) landing page (create or update).
  const landing = buildLanding(thisProduct, { siteSlug: site.slug, brand })
  const seo = { seoTitle: `${title} · ${brand}`, seoDescription: description.slice(0, 300) }
  const idx = pages.findIndex(p => p.slug === rawSlug)
  if (idx >= 0) {
    const np: SitePage = { ...pages[idx], title, fullHtml: landing, offline: false, ...seo }
    delete np.canvas // it's a full-page-HTML page now
    pages[idx] = np
  } else {
    pages.push({
      id: `pg-${rawSlug}-${pages.length + 1}`, slug: rawSlug, title,
      headline: '', subheadline: '', sections: [], fullHtml: landing, ...seo,
    } as SitePage)
  }

  // 4) regenerate the Resources library cards — ONLY when the workbooks read succeeded
  // (an incomplete product list would silently drop other books' cards) AND the markers
  // are present + unambiguous.
  const resIdx = pages.findIndex(p => p.slug === 'resources')
  let cardsUpdated = false
  if (workbooksOk && resIdx >= 0 && pages[resIdx].fullHtml) {
    const spliced = spliceProductsRegion(pages[resIdx].fullHtml as string, productsToCardsHtml(products))
    if (spliced.ok) { pages[resIdx] = { ...pages[resIdx], fullHtml: spliced.html }; cardsUpdated = true }
  }

  // 5) mirror Tuned In's price into the legacy keys the buy route still falls back to.
  const legacy: Partial<SiteContent> = rawSlug === 'tuned-in'
    ? { workbookPriceCents: priceCents, workbookCurrency: currency, workbookTitle: title }
    : {}

  // Spread the WHOLE existing content so no field (savedDesigns, siteLook, …) is dropped.
  try {
    await saveSiteContent(site.id, { ...base, ...legacy, pages, workbookProducts: wp })
  } catch (e) {
    return NextResponse.json({ error: 'Save failed: ' + String((e as Error)?.message || e) }, { status: 500 })
  }
  return NextResponse.json({ ok: true, slug: rawSlug, cardsUpdated })
}
