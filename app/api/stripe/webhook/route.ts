import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { constructAccountWebhookEvent, constructWebhookEvent } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// The Stripe webhook. Accepts events from EITHER endpoint: the platform ACCOUNT's own webhook
// (STRIPE_WEBHOOK_SECRET — direct charges on the owner's Stripe) OR the Connect webhook
// (STRIPE_CONNECT_WEBHOOK_SECRET — charges on a site's separate connected account). It verifies
// the signature against each secret in turn, then records sales + syncs connect status using the
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

  // Verify against EITHER secret. Try the platform-account secret first (direct charges), then the
  // Connect secret. Whichever verifies wins; if BOTH return null the signature is bad/unconfigured.
  const event = constructAccountWebhookEvent(body, sig) || constructWebhookEvent(body, sig)
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
      // Treat a pay-button checkout as a sale: kind 'pay', or ABSENT (back-compat with sessions
      // created before metadata.kind existed). Anything else with a kind is some other flow.
      const kind = session.metadata?.kind
      const isPay = !kind || kind === 'pay'
      const isBooking = kind === 'booking'
      // On a Connect event this carries the connected account that processed the charge; on a
      // direct charge to the platform account it is ABSENT.
      const eventAccount = (event as Stripe.Event & { account?: string }).account || null

      // BOOKING payment: confirm the held (pending_payment) appointment + record the revenue as a
      // sale, idempotently. Defense-in-depth: the appointment must belong to the named site's
      // owner, and on a Connect event the named site's connected account must match the processing
      // account. Appointments are keyed to a site by owner_id (= sites.owner_id), not site_id.
      if (isBooking && siteId && sessionId) {
        const appointmentId = session.metadata?.appointmentId
        const { data: site } = await admin
          .from('sites')
          .select('id, owner_id, stripe_account_id')
          .eq('id', siteId)
          .maybeSingle()
        const accountOk = !site
          ? false
          : eventAccount
            ? site.stripe_account_id === eventAccount // CONNECT: bind to the processing account
            : true // DIRECT: charge ran on the platform account — siteId is server-authoritative
        if (site && accountOk && appointmentId) {
          // Idempotent confirm: only flip a row that is STILL pending_payment for THIS site's owner.
          // A duplicate delivery (already confirmed) matches nothing -> no-op; a foreign
          // appointmentId can't be flipped because owner_id won't match.
          const { error: updErr } = await admin
            .from('appointments')
            .update({ status: 'confirmed', paid: true, stripe_session_id: sessionId })
            .eq('id', appointmentId)
            .eq('owner_id', site.owner_id)
            .eq('status', 'pending_payment')
          if (updErr) {
            console.error('[stripe webhook] booking confirm failed for appointment', appointmentId, updErr.message)
          }

          // Record booking revenue alongside Buy-button sales. Idempotent on stripe_session_id
          // (swallow 23505) so a duplicate webhook delivery never doubles the sale.
          const amountCents = typeof session.amount_total === 'number' ? session.amount_total : 0
          const currency = (session.currency || 'eur').toLowerCase()
          const email = session.customer_details?.email || session.customer_email || null
          const product = session.metadata?.productName || null
          const { error: salesErr } = await admin.from('sales').insert({
            site_id: siteId,
            amount_cents: amountCents,
            currency,
            product,
            customer_email: email,
            stripe_session_id: sessionId,
          })
          if (salesErr && salesErr.code !== '23505') {
            console.error('[stripe webhook] booking sale insert failed for session', sessionId, salesErr.message)
          }
        }
      }
      // Need both the attribution (siteId) + the idempotency key (session id) to record a sale.
      if (isPay && siteId && sessionId) {
        // Load the named site once; it must still exist to record a sale against it (guards against a
        // site deleted between checkout-start and webhook-delivery — avoids an orphan/FK-violating row).
        const { data: site } = await admin.from('sites').select('id, stripe_account_id').eq('id', siteId).maybeSingle()
        // Decide whether this is a Connect charge (bind to the connected account) or a direct charge
        // on the platform account (no account to bind to). `recordable` gates the insert.
        let recordable = false
        if (!site) {
          // The site is gone — nothing to attribute the sale to. Drop it (still ack 200).
          recordable = false
        } else if (eventAccount) {
          // CONNECT: bind the sale to the account that processed it — the site named in OUR metadata
          // must be the one whose connected account === event.account. Without this, another
          // connected-account owner could create a session with metadata.siteId pointing at someone
          // else's site and pollute that site's sales records. (No money moves cross-tenant either way.)
          recordable = site.stripe_account_id === eventAccount
        } else {
          // DIRECT: the charge ran on the PLATFORM's own account — there's no connected account to
          // match against, so record it against metadata.siteId as-is. The session was created by
          // our own server (amount + siteId are server-authoritative), so there's no cross-tenant risk.
          recordable = true
        }

        if (recordable) {
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
