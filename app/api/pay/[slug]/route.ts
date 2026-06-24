import { NextResponse } from 'next/server'
import { getCheckoutSite } from '@/lib/sites/public'
import { getPages, PAY_CURRENCIES, PAY_MIN_CENTS, PAY_MAX_CENTS, type CanvasElement, type SiteContent } from '@/lib/sites/types'
import { createConnectCheckout, createDirectCheckout, stripeConfigured } from '@/lib/stripe'
import { siteBaseUrl } from '@/lib/sites/baseurl'

// Stripe checkout for a canvas "Pay" button. The published PayButton POSTs ONLY { elementId }
// here (never an amount) — the price is read SERVER-SIDE from the saved element, so a tampered
// client can't change what they're charged. Two charge paths:
//   • DEFAULT (direct): the session is created on the PLATFORM owner's own Stripe account
//     (createDirectCheckout) — money settles straight to the owner. Works with just STRIPE_SECRET_KEY.
//   • OPT-IN (Connect): if THIS site has its own connected account set up (stripeAccountId +
//     chargesEnabled), the session is a direct charge on THAT account (createConnectCheckout),
//     so a separate seller gets their own money.
//
// Dormant-safe: with payments unconfigured this returns 400 { error } and never throws. No secret
// ever leaks to the response.

export const dynamic = 'force-dynamic'

// Find a button element with ctaType 'pay' by id across every page's canvas.
function findPayElement(content: SiteContent | null, elementId: string): CanvasElement | null {
  for (const page of getPages(content)) {
    const els = page.canvas?.elements
    if (!els) continue
    const el = els.find(e => e.id === elementId)
    // A hidden (paused/draft) pay button must not be purchasable even if its id is known from
    // the page source — only a live, visible pay button can start a checkout.
    if (el && el.type === 'button' && el.ctaType === 'pay' && !el.hidden) return el
  }
  return null
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    let elementId = ''
    try {
      const body = await req.json()
      elementId = String(body?.elementId ?? '').trim()
    } catch {
      // malformed / empty body
    }
    if (!elementId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

    const site = await getCheckoutSite(params.slug)
    if (!site) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const el = findPayElement(site.content, elementId)
    if (!el) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // SERVER-AUTHORITATIVE: read + re-validate the amount/currency/product from the SAVED element.
    // The client never sends these; even if it did, we ignore the body beyond elementId.
    const amountCents = Number(el.payAmount)
    if (!Number.isInteger(amountCents) || amountCents < PAY_MIN_CENTS || amountCents > PAY_MAX_CENTS) {
      return NextResponse.json({ error: 'bad_amount' }, { status: 400 })
    }
    const currency = (el.payCurrency && (PAY_CURRENCIES as readonly string[]).includes(el.payCurrency)) ? el.payCurrency : 'eur'
    const productName = (el.payProduct || '').trim().slice(0, 120) || 'Payment'

    // Payments must be switched on at the platform level (the owner's STRIPE_SECRET_KEY), else
    // there's nothing to charge to.
    if (!stripeConfigured()) {
      return NextResponse.json({ error: 'not_setup' }, { status: 400 })
    }

    const base = siteBaseUrl()
    const publicUrl = `${base}/s/${site.slug}`
    // Metadata the webhook reads to attribute the sale (siteId), tie it to the element, and
    // record the product name without having to expand the session's line items.
    const metadata = { kind: 'pay', siteId: site.id, elementId, productName }
    const successUrl = `${publicUrl}?paid=1`
    const cancelUrl = publicUrl

    // Two charge paths:
    //  - CONNECT: the site has its OWN connected, charges-enabled Stripe account → run the session
    //    as a direct charge on that account (it's the merchant of record). Kept for sites that opted
    //    into a separate seller.
    //  - DIRECT: otherwise, charge on the PLATFORM's own Stripe account (the owner's single Stripe).
    //    This is the simple default — no per-site Connect onboarding needed.
    const useConnect = !!(site.stripeAccountId && site.stripeChargesEnabled)
    const url = useConnect
      ? await createConnectCheckout({
          accountId: site.stripeAccountId as string,
          amountCents,
          currency,
          productName,
          successUrl,
          cancelUrl,
          metadata,
        })
      : await createDirectCheckout({
          amountCents,
          currency,
          productName,
          successUrl,
          cancelUrl,
          metadata,
        })
    if (!url) return NextResponse.json({ error: 'failed' }, { status: 500 })
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
