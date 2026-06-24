import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { constructWebhookEvent } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// The Stripe Connect webhook. Verifies the signature against STRIPE_CONNECT_WEBHOOK_SECRET
// (constructWebhookEvent), then records sales + syncs the owner's connect status using the
// SERVICE-ROLE client (no user session). DORMANT-safe: with payments unconfigured the event
// can't be verified, so it 400s and nothing runs. The only failure that returns 400 is a bad
// signature; handled + ignored events both return 200 so Stripe stops retrying.
//
// Node runtime: the Stripe SDK signature check needs the RAW request body + the Node crypto.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Raw body is required for signature verification — read it as text before any parsing.
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''

  const event = constructWebhookEvent(body, sig)
  // null = unconfigured OR an invalid signature → reject. This is the ONLY 400 path.
  if (!event) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })

  const admin = getSupabaseAdmin()
  // If the DB client is somehow unavailable we still ack (200) so Stripe doesn't hammer retries;
  // in practice constructWebhookEvent succeeding implies the platform is configured.
  if (!admin) return NextResponse.json({ received: true })

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const siteId = session.metadata?.siteId
      const sessionId = session.id
      // The Connect event carries the connected account that actually processed the charge.
      const eventAccount = (event as Stripe.Event & { account?: string }).account || null
      // Need both the attribution (siteId) + the idempotency key (session id) to record a sale.
      if (siteId && sessionId) {
        // Bind the sale to the account that processed it: the site named in OUR metadata must be the
        // one whose connected account === event.account. Without this, another connected-account
        // owner could create a session with metadata.siteId pointing at someone else's site and
        // pollute that site's sales records. (No money ever moves cross-tenant either way.)
        const { data: site } = await admin.from('sites').select('stripe_account_id').eq('id', siteId).maybeSingle()
        if (site && eventAccount && site.stripe_account_id === eventAccount) {
          const amountCents = typeof session.amount_total === 'number' ? session.amount_total : 0
          const currency = (session.currency || 'eur').toLowerCase()
          const email = session.customer_details?.email || session.customer_email || null
          // Product name: prefer the metadata (set at checkout creation); the line item is only
          // present when the session is expanded, so metadata is the reliable source here.
          const product = session.metadata?.productName || null

          // Idempotent on stripe_session_id (UNIQUE in migration 017): a duplicate webhook delivery
          // hits the unique constraint (Postgres code 23505) and is swallowed — never a double row.
          const { error } = await admin.from('sales').insert({
            site_id: siteId,
            amount_cents: amountCents,
            currency,
            product,
            customer_email: email,
            stripe_session_id: sessionId,
          })
          // 23505 = unique violation = already recorded; anything else we still ack to avoid retries,
          // but log it so a dropped sale-record (e.g. a transient DB error) is observable.
          if (error && error.code !== '23505') {
            console.error('[stripe webhook] sales insert failed for session', sessionId, error.message)
          }
        }
      }
    } else if (event.type === 'account.updated') {
      // The connected account's capabilities changed — sync our cached charges_enabled flag for the
      // site(s) linked to this account. `event.account` is the connected account id on Connect events.
      const account = event.data.object as Stripe.Account
      const accountId = (event as Stripe.Event & { account?: string }).account || account.id
      if (accountId) {
        await admin
          .from('sites')
          .update({ stripe_charges_enabled: !!account.charges_enabled, updated_at: new Date().toISOString() })
          .eq('stripe_account_id', accountId)
      }
    }
  } catch {
    // Never surface an error to Stripe (it would retry); the signature was already verified.
  }

  return NextResponse.json({ received: true })
}
