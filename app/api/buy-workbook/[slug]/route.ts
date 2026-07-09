import { NextResponse } from 'next/server'
import { getCheckoutSite } from '@/lib/sites/public'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createConnectCheckout, createDirectCheckout, stripeConfigured } from '@/lib/stripe'

// Stripe checkout to BUY the interactive workbook (Tuned In) from the public website. The price
// is read SERVER-SIDE from the site content (content.workbookPriceCents), so the client can't
// change what they're charged. On payment the Stripe webhook (kind:'workbook') grants access +
// emails the buyer a one-click sign-in link. Direct charge on the owner's Stripe by default;
// Connect if the site has its own connected account. Dormant-safe: 400 { error } if unconfigured.
//
// Two ways in:
//   GET  → 303-redirects the browser straight to Stripe (used by a plain <a target="_top"> link
//          on the full-page-HTML site, so checkout opens at the TOP level — Stripe refuses to be
//          framed, and a link needs no CORS). On any problem it bounces back to /resources.
//   POST → returns { url } as JSON (CORS-open) for buttons that prefer to fetch then redirect.
export const dynamic = 'force-dynamic'

const PORTAL = (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.animatemple.com').replace(/\/+$/, '')
const SITE = 'https://animatemple.com'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Per-product sale config. 'tuned-in' reads the legacy top-level content keys; any
// other product reads content.workbookProducts[slug] = { priceCents, currency, title }.
interface ProductCfg { amountCents: number; currency: string; productName: string }
function productConfig(content: Record<string, unknown>, product: string): ProductCfg | null {
  // Prefer the structured per-product config (set on the Resources page) for ANY product…
  const map = (content.workbookProducts ?? {}) as Record<string, unknown>
  const cfg = map[product] as Record<string, unknown> | undefined
  if (cfg) {
    // Only items sold à la carte are buyable; free / members-only are not.
    const access = cfg.access
    if (access === 'free' || access === 'members') return null
    const priceCents = Number(cfg.priceCents)
    if (Number.isInteger(priceCents) && priceCents >= 100) {
      const sale = Number(cfg.salePriceCents)
      // Charge the reduced price when it's set + genuinely lower.
      const amountCents = Number.isInteger(sale) && sale >= 100 && sale < priceCents ? sale : priceCents
      const currency = typeof cfg.currency === 'string' && cfg.currency ? cfg.currency.toLowerCase() : 'eur'
      const productName = (typeof cfg.title === 'string' && cfg.title.trim()) ? cfg.title.trim().slice(0, 120) : product
      return { amountCents, currency, productName }
    }
  }
  // …falling back to the legacy top-level keys for Tuned In.
  if (product === 'tuned-in') {
    const amountCents = Number(content.workbookPriceCents)
    if (!Number.isInteger(amountCents)) return null
    const currency = typeof content.workbookCurrency === 'string' && content.workbookCurrency ? content.workbookCurrency.toLowerCase() : 'eur'
    const productName = (typeof content.workbookTitle === 'string' && content.workbookTitle.trim()) ? content.workbookTitle.trim().slice(0, 120) : 'Tuned In'
    return { amountCents, currency, productName }
  }
  return null
}

// Shared checkout builder. `product` is the workbook product slug (default 'tuned-in').
// Returns a Stripe URL or a typed error + HTTP status.
async function startCheckout(slug: string, product: string): Promise<{ url?: string; error?: string; status: number }> {
  const site = await getCheckoutSite(slug)
  if (!site) return { error: 'not_found', status: 404 }

  const c = (site.content ?? {}) as Record<string, unknown>
  const cfg = productConfig(c, product)
  if (!cfg) return { error: 'not_for_sale', status: 400 }
  const { amountCents, currency, productName } = cfg
  if (amountCents < 100 || amountCents > 500000) {
    return { error: 'not_for_sale', status: 400 }
  }

  // The DATABASE is authoritative for buyability (content can drift): the product must be
  // sold à la carte, and a downloadable file must actually have a file to deliver. Read the
  // product's own row via service role — this is a public checkout with no owner session.
  let prodKind: 'workbook' | 'download' = 'workbook'
  const admin = getSupabaseAdmin()
  if (admin) {
    const { data: row } = await admin
      .from('workbooks')
      .select('access, kind, file_path')
      .eq('owner_id', site.ownerId)
      .eq('slug', product)
      .maybeSingle()
    if (!row || row.access !== 'paid') return { error: 'not_for_sale', status: 400 }
    if (row.kind === 'download' && !row.file_path) return { error: 'not_for_sale', status: 400 }
    prodKind = row.kind === 'download' ? 'download' : 'workbook'
  }

  if (!stripeConfigured()) return { error: 'not_setup', status: 400 }

  const successUrl = `${PORTAL}/me?bought=workbook`
  const cancelUrl = `${SITE}/resources`
  const metadata = { kind: 'workbook', siteId: site.id, ownerId: site.ownerId, productName, productSlug: product, productKind: prodKind }

  const useConnect = !!(site.stripeAccountId && site.stripeChargesEnabled)
  const url = useConnect
    ? await createConnectCheckout({ accountId: site.stripeAccountId as string, amountCents, currency, productName, successUrl, cancelUrl, metadata })
    : await createDirectCheckout({ amountCents, currency, productName, successUrl, cancelUrl, metadata })

  if (!url) return { error: 'failed', status: 500 }
  return { url, status: 200 }
}

// Read + validate the product slug from ?product= (default 'tuned-in').
function productParam(req: Request): string {
  const raw = (new URL(req.url).searchParams.get('product') || 'tuned-in').toLowerCase()
  return /^[a-z0-9-]{1,60}$/.test(raw) ? raw : 'tuned-in'
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const r = await startCheckout(params.slug, productParam(req))
    if (r.url) return NextResponse.redirect(r.url, 303)
    return NextResponse.redirect(`${SITE}/resources?buy=${r.error || 'failed'}`, 303)
  } catch {
    return NextResponse.redirect(`${SITE}/resources?buy=failed`, 303)
  }
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const r = await startCheckout(params.slug, productParam(req))
    return r.url
      ? NextResponse.json({ url: r.url }, { headers: CORS })
      : NextResponse.json({ error: r.error }, { status: r.status, headers: CORS })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500, headers: CORS })
  }
}
