import { NextResponse } from 'next/server'
import { getCheckoutSite } from '@/lib/sites/public'
import { createConnectCheckout, createDirectCheckout, stripeConfigured } from '@/lib/stripe'

// Stripe checkout to BUY the interactive workbook (Tuned In) from the public website. The price
// is read SERVER-SIDE from the site content (content.workbookPriceCents), so the client can't
// change what they're charged. On payment the Stripe webhook (kind:'workbook') grants access +
// emails the buyer a one-click sign-in link. Direct charge on the owner's Stripe by default;
// Connect if the site has its own connected account. Dormant-safe: 400 { error } if unconfigured.
export const dynamic = 'force-dynamic'

const PORTAL = (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.animatemple.com').replace(/\/+$/, '')
const SITE = 'https://animatemple.com'

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const site = await getCheckoutSite(params.slug)
    if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const c = (site.content ?? {}) as Record<string, unknown>
    const amountCents = Number(c.workbookPriceCents)
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 500000) {
      return NextResponse.json({ error: 'not_for_sale' }, { status: 400 })
    }
    const currency = typeof c.workbookCurrency === 'string' && c.workbookCurrency ? c.workbookCurrency.toLowerCase() : 'eur'
    const productName = (typeof c.workbookTitle === 'string' && c.workbookTitle.trim()) ? c.workbookTitle.trim().slice(0, 120) : 'Tuned In'

    if (!stripeConfigured()) return NextResponse.json({ error: 'not_setup' }, { status: 400 })

    const successUrl = `${PORTAL}/me?bought=workbook`
    const cancelUrl = `${SITE}/resources`
    const metadata = { kind: 'workbook', siteId: site.id, ownerId: site.ownerId, productName }

    const useConnect = !!(site.stripeAccountId && site.stripeChargesEnabled)
    const url = useConnect
      ? await createConnectCheckout({ accountId: site.stripeAccountId as string, amountCents, currency, productName, successUrl, cancelUrl, metadata })
      : await createDirectCheckout({ amountCents, currency, productName, successUrl, cancelUrl, metadata })

    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 })
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
