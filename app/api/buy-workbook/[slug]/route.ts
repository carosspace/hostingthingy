import { NextResponse } from 'next/server'
import { getCheckoutSite } from '@/lib/sites/public'
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

// Shared checkout builder. Returns a Stripe URL or a typed error + HTTP status.
async function startCheckout(slug: string): Promise<{ url?: string; error?: string; status: number }> {
  const site = await getCheckoutSite(slug)
  if (!site) return { error: 'not_found', status: 404 }

  const c = (site.content ?? {}) as Record<string, unknown>
  const amountCents = Number(c.workbookPriceCents)
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 500000) {
    return { error: 'not_for_sale', status: 400 }
  }
  const currency = typeof c.workbookCurrency === 'string' && c.workbookCurrency ? c.workbookCurrency.toLowerCase() : 'eur'
  const productName = (typeof c.workbookTitle === 'string' && c.workbookTitle.trim()) ? c.workbookTitle.trim().slice(0, 120) : 'Tuned In'

  if (!stripeConfigured()) return { error: 'not_setup', status: 400 }

  const successUrl = `${PORTAL}/me?bought=workbook`
  const cancelUrl = `${SITE}/resources`
  const metadata = { kind: 'workbook', siteId: site.id, ownerId: site.ownerId, productName }

  const useConnect = !!(site.stripeAccountId && site.stripeChargesEnabled)
  const url = useConnect
    ? await createConnectCheckout({ accountId: site.stripeAccountId as string, amountCents, currency, productName, successUrl, cancelUrl, metadata })
    : await createDirectCheckout({ amountCents, currency, productName, successUrl, cancelUrl, metadata })

  if (!url) return { error: 'failed', status: 500 }
  return { url, status: 200 }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const r = await startCheckout(params.slug)
    if (r.url) return NextResponse.redirect(r.url, 303)
    return NextResponse.redirect(`${SITE}/resources?buy=${r.error || 'failed'}`, 303)
  } catch {
    return NextResponse.redirect(`${SITE}/resources?buy=failed`, 303)
  }
}

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const r = await startCheckout(params.slug)
    return r.url
      ? NextResponse.json({ url: r.url }, { headers: CORS })
      : NextResponse.json({ error: r.error }, { status: r.status, headers: CORS })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500, headers: CORS })
  }
}
