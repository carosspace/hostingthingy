import Stripe from 'stripe'

// Platform Stripe client + Connect helpers (multi-tenant Stripe Connect, stage 1).
//
// SERVER-ONLY. STRIPE_SECRET_KEY is read here and must NEVER reach the client — do
// not import this from a Client Component.
//
// Everything is FAIL-SAFE and stays fully DORMANT until the env is configured: with no
// STRIPE_SECRET_KEY, `stripeConfigured()` is false, `getStripe()` returns null, and every
// helper no-ops and returns null instead of throwing. Nothing here throws at import time
// or at call time, so the dashboard renders a calm "payments aren't enabled" note and no
// server action errors. Once STRIPE_SECRET_KEY is set (and Connect is enabled on the
// platform's Stripe account), the same helpers do the real work.
//
// Model: each site owner connects THEIR OWN Stripe Express connected account; they are
// the merchant of record. Checkout (stage 2) runs as a DIRECT CHARGE on the connected
// account (the `{ stripeAccount }` request option), with an optional application fee to
// the platform.

// Pinned to the version bundled with the installed `stripe` package (17.x → acacia).
const STRIPE_API_VERSION = '2025-02-24.acacia'

// True only when the platform secret key is present. Drives the dormant behaviour.
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// Lazily build the platform Stripe client. Returns null when unconfigured so callers
// can degrade gracefully. A fresh instance is cheap and avoids holding a client built
// from a stale/empty key.
export function getStripe(): Stripe | null {
  if (!stripeConfigured()) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION })
}

// Create an Express connected account for an owner. Returns the new account id, or null
// if unconfigured / on any Stripe error.
export async function createExpressAccount(email?: string): Promise<string | null> {
  const stripe = getStripe()
  if (!stripe) return null
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      ...(email ? { email } : {}),
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })
    return account.id
  } catch {
    return null
  }
}

// Create a hosted onboarding link for a connected account. `refreshUrl` is where Stripe
// sends the owner if the link expires; `returnUrl` is where they land when done. Returns
// the URL, or null if unconfigured / on error.
export async function createOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string | null> {
  const stripe = getStripe()
  if (!stripe || !accountId) return null
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    })
    return link.url
  } catch {
    return null
  }
}

export interface StripeAccountStatus {
  chargesEnabled: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
}

// Read the live capability status of a connected account (used to flip the owner's
// stripe_charges_enabled flag). Returns null if unconfigured / on error.
export async function getAccountStatus(accountId: string): Promise<StripeAccountStatus | null> {
  const stripe = getStripe()
  if (!stripe || !accountId) return null
  try {
    const account = await stripe.accounts.retrieve(accountId)
    return {
      chargesEnabled: !!account.charges_enabled,
      detailsSubmitted: !!account.details_submitted,
      payoutsEnabled: !!account.payouts_enabled,
    }
  } catch {
    return null
  }
}

// A one-time link into the connected account's Express dashboard (so the owner can see
// their payouts/payments). Returns the URL, or null if unconfigured / on error.
export async function createLoginLink(accountId: string): Promise<string | null> {
  const stripe = getStripe()
  if (!stripe || !accountId) return null
  try {
    const link = await stripe.accounts.createLoginLink(accountId)
    return link.url
  } catch {
    return null
  }
}

export interface ConnectCheckoutOptions {
  accountId: string
  amountCents: number
  currency: string
  productName: string
  quantity?: number
  customerEmail?: string
  successUrl: string
  cancelUrl: string
  applicationFeeCents?: number
  metadata?: Record<string, string>
}

// Create a Checkout Session as a DIRECT CHARGE on the owner's connected account: the
// `{ stripeAccount }` request option (second arg) makes the owner the merchant of record,
// money settles to them, and the platform optionally takes `applicationFeeCents`. Returns
// the hosted checkout URL, or null if unconfigured / on error. (Called by stage 2.)
export async function createConnectCheckout(opts: ConnectCheckoutOptions): Promise<string | null> {
  const stripe = getStripe()
  if (!stripe || !opts.accountId) return null
  try {
    const quantity = opts.quantity && opts.quantity > 0 ? Math.floor(opts.quantity) : 1
    const fee = opts.applicationFeeCents && opts.applicationFeeCents > 0 ? Math.floor(opts.applicationFeeCents) : 0

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity,
            price_data: {
              currency: opts.currency,
              unit_amount: opts.amountCents,
              product_data: { name: opts.productName },
            },
          },
        ],
        ...(opts.customerEmail ? { customer_email: opts.customerEmail } : {}),
        ...(fee > 0 ? { payment_intent_data: { application_fee_amount: fee } } : {}),
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        ...(opts.metadata ? { metadata: opts.metadata } : {}),
      },
      // DIRECT CHARGE: run the session on the connected account.
      { stripeAccount: opts.accountId },
    )
    return session.url
  } catch {
    return null
  }
}

// Verify + parse a Connect webhook payload against STRIPE_CONNECT_WEBHOOK_SECRET. Returns
// null if unconfigured (no key or no webhook secret) or if the signature is invalid — the
// caller (stage 2 webhook route) must treat null as "reject". Never throws.
export function constructWebhookEvent(body: string, sig: string): Stripe.Event | null {
  const stripe = getStripe()
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!stripe || !secret || !sig) return null
  try {
    return stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return null
  }
}
