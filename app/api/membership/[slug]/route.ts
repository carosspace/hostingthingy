import { NextResponse } from 'next/server'
import { getCheckoutSite } from '@/lib/sites/public'
import { getPaidTierForOwner } from '@/lib/memberships/public'
import { createSubscriptionCheckout, stripeConfigured } from '@/lib/stripe'
import { siteBaseUrl } from '@/lib/sites/baseurl'

// Start a recurring SUBSCRIPTION checkout for a paid membership tier. The public join page POSTs ONLY
// { tierId } here (never a price) — the amount/currency/interval are read SERVER-SIDE from the tier
// row, so a tampered client can't change what they're charged. The session is a DIRECT subscription
// on the PLATFORM's own Stripe account (the owner's single Stripe); money settles to the owner. The
// client's email is collected by Stripe Checkout.
//
// Dormant-safe: with payments unconfigured (or the site/tier missing) this returns 4xx { error } and
// never throws. No secret ever leaks to the response.

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    let tierId = ''
    try {
      const body = await req.json()
      tierId = String(body?.tierId ?? '').trim()
    } catch {
      // malformed / empty body
    }
    if (!tierId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

    // Resolve the live site (and its owner) from the trusted slug, server-side.
    const site = await getCheckoutSite(params.slug)
    if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Load the tier via the admin client and confirm it belongs to THIS site's owner AND is priced.
    // Rejects a free/manual tier or a tier id pointing at someone else's tier.
    const tier = await getPaidTierForOwner(tierId, site.ownerId)
    if (!tier) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Payments must be switched on at the platform level (the owner's STRIPE_SECRET_KEY).
    if (!stripeConfigured()) {
      return NextResponse.json({ error: 'not_setup' }, { status: 400 })
    }

    const base = siteBaseUrl()
    const joinUrl = `${base}/join/${site.slug}`
    // SERVER-AUTHORITATIVE: price/currency/interval come straight from the saved tier row.
    // Metadata is carried on BOTH the session and the subscription (subscription_data.metadata) so
    // the webhook can attribute the grant on checkout AND keep status in sync on lifecycle events.
    const metadata = {
      kind: 'membership',
      tierId: tier.id,
      ownerId: site.ownerId,
      siteId: site.id,
      slug: site.slug,
    }
    const url = await createSubscriptionCheckout({
      amountCents: tier.priceCents,
      currency: tier.currency,
      interval: tier.interval,
      productName: tier.name,
      successUrl: `${joinUrl}?joined=1`,
      cancelUrl: joinUrl,
      metadata,
    })
    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 })
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
