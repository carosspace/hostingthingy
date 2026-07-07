import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SiteContent, WorkbookProduct } from '@/lib/sites/types'

// The owner's view of one sellable book: the site-content metadata merged with the
// `workbooks` table (which holds the actual interactive HTML, keyed by owner + slug).
export interface OwnerProduct {
  slug: string
  title: string
  priceCents: number
  currency: string
  description: string
  coverImage: string
  tagline: string
  landingMode: 'form' | 'html'
  landingBody: string
  landingHtml: string
  order: number
  hidden: boolean
  hasContent: boolean // an interactive HTML file has been uploaded for this slug
  updatedAt: string | null
}

const PORTAL = (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.animatemple.com').replace(/\/+$/, '')

// The public checkout link for a product (absolute app URL so it works from the
// custom-domain iframe; target=_top opens Stripe at the top level).
export function buyUrl(siteSlug: string, productSlug: string): string {
  return `${PORTAL}/api/buy-workbook/${encodeURIComponent(siteSlug)}?product=${encodeURIComponent(productSlug)}`
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

const SYMBOL: Record<string, string> = { eur: '€', usd: '$', gbp: '£' }
export function priceLabel(priceCents: number, currency: string): string {
  const sym = SYMBOL[(currency || 'eur').toLowerCase()] || ''
  const v = priceCents / 100
  const n = Number.isInteger(v) ? String(v) : v.toFixed(2)
  return sym ? `${sym}${n}` : `${n} ${(currency || '').toUpperCase()}`
}

// Merge the workbooks table (existence + hasContent + title) with the content
// metadata (price, cover, landing, …) into one list. Reads the OWNER's rows via
// their session (RLS). GRACEFUL: returns [] on any error.
export interface OwnerProductList {
  products: OwnerProduct[]
  workbooksOk: boolean // the workbooks table read succeeded (so the list is complete)
}

export async function listOwnerProducts(ownerId: string, content: SiteContent | null): Promise<OwnerProductList> {
  const map: Record<string, OwnerProduct> = {}
  const blank = (slug: string): OwnerProduct => ({
    slug, title: slug, priceCents: 0, currency: 'eur', description: '', coverImage: '', tagline: '',
    landingMode: 'html', landingBody: '', landingHtml: '', order: 0, hidden: false, hasContent: false, updatedAt: null,
  })

  // 1) workbook rows — the source of truth for which products exist + have content.
  // workbooksOk tells the caller the list is COMPLETE: if this read fails we must NOT
  // regenerate the library cards (we'd silently drop products that live only as a row).
  let workbooksOk = false
  try {
    const sb = createSupabaseServerClient()
    const { data: rows, error: e1 } = await sb.from('workbooks').select('slug, title, updated_at').eq('owner_id', ownerId)
    if (e1) throw e1
    const { data: filled } = await sb.from('workbooks').select('slug').eq('owner_id', ownerId).not('html_content', 'is', null)
    const has = new Set((filled || []).map(r => String(r.slug)))
    for (const r of rows || []) {
      const slug = String(r.slug)
      map[slug] = { ...blank(slug), title: String(r.title || 'Workbook'), hasContent: has.has(slug), updatedAt: (r.updated_at as string) || null }
    }
    workbooksOk = true
  } catch {
    // table not migrated / no session / transient failure → list is content-only + incomplete
  }

  // 2) overlay the content metadata.
  const wp = (content?.workbookProducts || {}) as Record<string, WorkbookProduct>
  for (const [slug, p] of Object.entries(wp)) {
    const base = map[slug] || blank(slug)
    map[slug] = {
      ...base,
      title: p.title || base.title,
      priceCents: Number.isInteger(p.priceCents) ? p.priceCents : base.priceCents,
      currency: p.currency || base.currency,
      description: p.description ?? base.description,
      coverImage: p.coverImage ?? base.coverImage,
      tagline: p.tagline ?? base.tagline,
      landingMode: p.landingMode || base.landingMode,
      landingBody: p.landingBody ?? base.landingBody,
      landingHtml: p.landingHtml ?? base.landingHtml,
      order: Number.isFinite(p.order as number) ? (p.order as number) : base.order,
      hidden: !!p.hidden,
    }
  }

  // 3) legacy Tuned In price/title/currency (pre-workbookProducts).
  const ti = map['tuned-in']
  if (ti) {
    if (!ti.priceCents && Number.isInteger(content?.workbookPriceCents)) ti.priceCents = content!.workbookPriceCents as number
    if (!wp['tuned-in']?.title && typeof content?.workbookTitle === 'string' && content.workbookTitle) ti.title = content.workbookTitle
    if (typeof content?.workbookCurrency === 'string' && content.workbookCurrency) ti.currency = content.workbookCurrency
  }

  // 4) landing fallback — if no landing is stored yet but a full-page HTML already
  // exists for this slug, treat that published page as the current custom HTML so
  // editing never loses the design that's already live.
  const pages = content?.pages || []
  for (const slug of Object.keys(map)) {
    if (!map[slug].landingHtml && map[slug].landingMode !== 'form') {
      const pg = pages.find(p => p.slug === slug)
      if (pg?.fullHtml && pg.fullHtml.trim()) {
        map[slug].landingMode = 'html'
        map[slug].landingHtml = pg.fullHtml
      }
    }
  }

  const products = Object.values(map).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  return { products, workbooksOk }
}

// ─────────────────────────── landing pages ───────────────────────────

const BUY_STYLE =
  'display:inline-block;margin-top:.4rem;padding:1.05rem 2.6rem;border-radius:2px;font-family:\'Cinzel\',serif;font-size:.74rem;letter-spacing:.24em;text-transform:uppercase;color:#1A1108;text-decoration:none;font-weight:600;background:linear-gradient(180deg,#E8D5A8,#C9A96E);box-shadow:0 14px 34px -14px rgba(201,169,110,.6);'

function buyButton(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" target="_top" rel="nofollow noopener" style="${BUY_STYLE}">${escapeHtml(label)}</a>`
}

// FORM MODE — render a clean, brand-consistent landing (cream/gold, Cormorant/Cinzel/
// Jost, dark), from the product's fields. All sizing is px (no vh) so it's safe in the
// auto-height site iframe, and there are no opacity-until-JS reveals.
export function buildFormLanding(p: OwnerProduct, opts: { siteSlug: string; brand?: string }): string {
  const brand = opts.brand || 'Anima Temple'
  const url = buyUrl(opts.siteSlug, p.slug)
  const price = priceLabel(p.priceCents, p.currency)
  const paras = (p.landingBody || p.description || '')
    .split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
    .map(t => `<p>${escapeHtml(t).replace(/\n/g, '<br>')}</p>`).join('\n      ')
  const cover = p.coverImage
    ? `<div style="margin:2rem auto 0;width:210px;max-width:70%;aspect-ratio:3/4;border-radius:6px;background:url('${escapeHtml(p.coverImage)}') center/cover;box-shadow:0 24px 60px -24px rgba(0,0,0,.6);"></div>`
    : ''
  const tagline = p.tagline ? `<div class="sub">${escapeHtml(p.tagline)}</div>` : ''

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(p.title)} &middot; ${escapeHtml(brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#1A1108;color:#E8C5B0;font-family:'Jost',sans-serif;font-weight:300;line-height:1.95;font-size:1.02rem;-webkit-font-smoothing:antialiased;
    background-image:radial-gradient(120% 60% at 50% -8%,rgba(201,169,110,.10),transparent 60%),radial-gradient(90% 50% at 50% 108%,rgba(168,92,64,.08),transparent 60%);}
  .wrap{max-width:680px;margin:0 auto;padding:0 1.6rem}
  em{font-style:italic;color:#E8D5A8}
  .hero{min-height:520px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:4.5rem 0 2rem}
  .eyebrow{font-family:'Cinzel',serif;font-size:.66rem;letter-spacing:.44em;text-transform:uppercase;color:#C9A96E;opacity:.85;margin-bottom:2rem}
  h1{font-family:'Cormorant Garamond',serif;font-weight:500;color:#FAF7F2;font-size:clamp(3rem,10vw,5rem);line-height:1.03}
  .sub{font-family:'Cormorant Garamond',serif;font-style:italic;color:#E8C5B0;font-size:clamp(1.2rem,4.4vw,1.6rem);margin-top:1rem;opacity:.92}
  section{padding:1rem 0}
  p{margin-bottom:1.35rem;color:#E8C5B0;font-weight:300}
  .orn{text-align:center;color:#C9A96E;font-size:1.3rem;margin:2.8rem 0;opacity:.85;letter-spacing:.4em;font-family:'Cormorant Garamond',serif}
  .offer{text-align:center;padding:1rem 0 .5rem}
  .price{font-family:'Cormorant Garamond',serif;color:#E8D5A8;font-size:2.6rem;line-height:1;margin-bottom:.3rem}
  .price small{font-family:'Jost',sans-serif;font-size:.62rem;letter-spacing:.3em;text-transform:uppercase;color:#8a6f5c;display:block;margin-top:.7rem}
  footer{text-align:center;padding:4rem 0 5rem}
  footer .mark{font-family:'Cinzel',serif;font-size:.62rem;letter-spacing:.4em;text-transform:uppercase;color:#C9A96E;opacity:.7}
</style></head>
<body>
<div class="wrap">
  <header class="hero">
    <div class="eyebrow">${escapeHtml(brand)}</div>
    <h1>${escapeHtml(p.title)}</h1>
    ${tagline}
    ${cover}
  </header>
  <div class="orn">&#10022;</div>
  <section>
      ${paras || `<p>${escapeHtml(p.description || '')}</p>`}
  </section>
  <div class="orn">&#10022;</div>
  <section class="offer">
    <div class="price">${escapeHtml(price)}<small>one quiet thing, made with care</small></div>
    ${buyButton(`If it is for you, it is here`, url)}
  </section>
  <footer><div class="mark">${escapeHtml(brand)}</div></footer>
</div>
</body></html>`
}

// HTML MODE — the owner's own landing HTML, made safe for the site iframe: convert vh
// (which balloons in the auto-height frame) to px, and ensure exactly one wired Buy
// button. If the HTML has a {{BUY}} placeholder, that becomes the button; else if it
// has no checkout link yet, a tasteful buy bar is appended.
export function renderSafeHtml(html: string, p: OwnerProduct, opts: { siteSlug: string }): string {
  const url = buyUrl(opts.siteSlug, p.slug)
  const label = `${p.title} · ${priceLabel(p.priceCents, p.currency)}`
  let h = String(html || '')
  h = h.replace(/([0-9.]+)vh/g, (_m, n) => Math.max(40, Math.round(parseFloat(n) * 7)) + 'px')
  const btn = buyButton(label, url)
  if (h.includes('{{BUY}}')) {
    h = h.split('{{BUY}}').join(btn)
  } else if (!/api\/buy-workbook\//.test(h)) {
    const bar = `<div style="text-align:center;padding:3rem 1.5rem;background:#1A1108;">${btn}</div>`
    h = /<\/body>/i.test(h) ? h.replace(/<\/body>/i, `${bar}</body>`) : h + bar
  }
  return h
}

// Produce the final landing fullHtml for a product (form or html mode).
export function buildLanding(p: OwnerProduct, opts: { siteSlug: string; brand?: string }): string {
  return p.landingMode === 'form'
    ? buildFormLanding(p, opts)
    : renderSafeHtml(p.landingHtml || '', p, opts)
}

// ─────────────────────────── library cards ───────────────────────────

// One .lib-item card for the Resources library grid (matches the classes defined in the
// resources page). Uses the uploaded cover if present, else the gradient placeholder.
export function buildLibraryCard(p: OwnerProduct): string {
  const price = priceLabel(p.priceCents, p.currency)
  const cover = p.coverImage
    ? `<div class="lib-cover" style="background:url('${escapeHtml(p.coverImage)}') center/cover;"></div>`
    : `<div class="lib-cover" style="background:linear-gradient(160deg,#241307 0%,#3D2415 68%,#241307 100%);">
              <span class="lib-cover-star" aria-hidden="true">&#10022;</span>
              <span class="lib-cover-title">${escapeHtml(p.title)}</span>
              <span class="lib-cover-sub">Anima Temple</span>
            </div>`
  return `<a class="lib-item" href="/${escapeHtml(p.slug)}">
            ${cover}
            <div class="lib-meta">
              <p class="eyebrow">Interactive book</p>
              <h3>${escapeHtml(p.title)}</h3>
              <p class="muted" style="margin:0;">${escapeHtml(p.description || '')}</p>
              <span class="lib-cta">Discover &middot; ${escapeHtml(price)} <span class="ar" aria-hidden="true">&#8594;</span></span>
            </div>
          </a>`
}

export function productsToCardsHtml(products: OwnerProduct[]): string {
  return products.filter(p => !p.hidden).map(buildLibraryCard).join('\n          ')
}

// Splice the generated cards into the resources page between the PRODUCTS markers.
// Returns { html, ok } — ok=false if the markers aren't present (so the caller can skip
// the resources update rather than corrupt the page).
const START = '<!--PRODUCTS_START-->'
const END = '<!--PRODUCTS_END-->'
export function spliceProductsRegion(resourcesHtml: string, cardsHtml: string): { html: string; ok: boolean } {
  const a = resourcesHtml.indexOf(START)
  const b = resourcesHtml.indexOf(END)
  // Bail (leave the page untouched) if a marker is missing, out of order, or DUPLICATED —
  // splicing a malformed/duplicated-marker page would silently corrupt it.
  if (a === -1 || b === -1 || b < a) return { html: resourcesHtml, ok: false }
  if (a !== resourcesHtml.lastIndexOf(START) || b !== resourcesHtml.lastIndexOf(END)) return { html: resourcesHtml, ok: false }
  return { html: resourcesHtml.slice(0, a + START.length) + '\n          ' + cardsHtml + '\n        ' + resourcesHtml.slice(b), ok: true }
}
