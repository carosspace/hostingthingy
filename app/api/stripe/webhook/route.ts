import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { constructAccountWebhookEvent, constructWebhookEvent, getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { notifyBookingConfirmed } from '@/lib/bookings/notify'
import { inviteToPortal } from '@/lib/portal/invite'

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

// Our membership lifecycle status, mapped from Stripe's subscription.status. active/trialing → we
// treat as 'active' (gated access on); past_due → 'past_due' (a soft warning, but gating requires
// 'active' so access is off); everything terminal (canceled/unpaid/incomplete_expired/incomplete/
// paused) → 'canceled'. Gating (get_my_courses) requires status='active', so only active/trialing
// keep gated-course access.
function mapSubStatus(stripeStatus: string | null | undefined): 'active' | 'past_due' | 'canceled' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    default:
      return 'canceled'
  }
}

// A Stripe Subscription's current_period_end is a UNIX seconds timestamp; convert to an ISO string
// (or null if absent), for memberships.current_period_end.
function periodEndIso(sub: Stripe.Subscription): string | null {
  const end = (sub as unknown as { current_period_end?: number }).current_period_end
  return typeof end === 'number' && end > 0 ? new Date(end * 1000).toISOString() : null
}

// Reconcile a membership row from a subscription event that arrived BEFORE its checkout grant
// (Stripe doesn't guarantee webhook ordering). We set kind/tierId/ownerId on subscription_data.metadata
// when creating the checkout, so the subscription event carries enough to upsert the row with the
// CORRECT status — instead of silently dropping the 0-row update and later resurrecting it to 'active'.
// Best-effort + never throws (a verified webhook must still return 200).
async function reconcileMembershipFromSub(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  sub: Stripe.Subscription,
  status: 'active' | 'past_due' | 'canceled',
): Promise<void> {
  const md = sub.metadata || {}
  if (md.kind !== 'membership' || !md.tierId || !md.ownerId) {
    console.warn('[stripe webhook] subscription event matched 0 rows; no membership metadata to reconcile', sub.id)
    return
  }
  try {
    const stripe = getStripe()
    const custId = typeof sub.customer === 'string' ? sub.customer : null
    let email: string | null = null
    if (stripe && custId) {
      const cust = await stripe.customers.retrieve(custId)
      if (cust && !('deleted' in cust && cust.deleted)) {
        email = ((cust as Stripe.Customer).email || '').trim().toLowerCase() || null
      }
    }
    if (!email) {
      console.warn('[stripe webhook] subscription event matched 0 rows; no customer email to reconcile', sub.id)
      return
    }
    await admin.from('memberships').upsert(
      {
        owner_id: md.ownerId,
        tier_id: md.tierId,
        client_email: email,
        status,
        current_period_end: periodEndIso(sub),
        stripe_subscription_id: sub.id,
        ...(custId ? { stripe_customer_id: custId } : {}),
      },
      { onConflict: 'tier_id,client_email' },
    )
  } catch {
    console.warn('[stripe webhook] subscription 0-row reconcile failed', sub.id)
  }
}

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
      const isMembership = kind === 'membership'
      const isWorkbook = kind === 'workbook'
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
          const { data: confirmed, error: updErr } = await admin
            .from('appointments')
            .update({ status: 'confirmed', paid: true, stripe_session_id: sessionId })
            .eq('id', appointmentId)
            .eq('owner_id', site.owner_id)
            .eq('status', 'pending_payment')
            .select('id')
          if (updErr) {
            console.error('[stripe webhook] booking confirm failed for appointment', appointmentId, updErr.message)
          }

          // Fire-and-forget the confirmation + owner-notification emails ONLY when this
          // delivery actually flipped the row (so a duplicate webhook never re-emails).
          // notifyBookingConfirmed is dormant-safe (no-op without RESEND_API_KEY) and
          // swallows all errors; the extra .catch() guards the floating promise so a
          // rejection can never affect the webhook's prompt 200.
          if (!updErr && confirmed && confirmed.length > 0) {
            void notifyBookingConfirmed(appointmentId).catch(() => {})
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
      // MEMBERSHIP subscription: a paid membership checkout completed (mode 'subscription'). GRANT the
      // membership idempotently. Only act when tier_id + owner_id + client_email are all present; the
      // upsert on (tier_id, client_email) makes a duplicate delivery a no-op / safe update.
      if (isMembership) {
        const tierId = session.metadata?.tierId || null
        const ownerId = session.metadata?.ownerId || null
        const clientEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase() || null
        // session.subscription / session.customer are ids on a completed subscription checkout.
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
        const customerId = typeof session.customer === 'string' ? session.customer : null

        if (tierId && ownerId && clientEmail) {
          // Derive the TRUE current status from the live subscription rather than assuming 'active'.
          // Webhook delivery is UNORDERED: a customer.subscription.updated(past_due) or .deleted can
          // arrive BEFORE this grant. If we forced 'active' here, that out-of-order cancel would be
          // overwritten and the member would keep gated access they no longer pay for. Reading the
          // subscription's real status closes that window. (getStripe() is non-null on a verified
          // webhook — the secret is set — but guard anyway so a Stripe hiccup can't break the 200.)
          let status: 'active' | 'past_due' | 'canceled' = 'active'
          let periodEnd: string | null = null
          if (subscriptionId) {
            try {
              const stripe = getStripe()
              if (stripe) {
                const sub = await stripe.subscriptions.retrieve(subscriptionId)
                status = mapSubStatus(sub.status)
                periodEnd = periodEndIso(sub)
              }
            } catch {
              // Fall back to 'active' (a completed checkout usually means the first invoice was paid);
              // a later subscription.* event will reconcile the true status.
            }
          }
          // Decide whether to auto-invite (below) BEFORE the upsert. We welcome a buyer the FIRST
          // time they hold ANY membership with THIS owner — keyed by owner_id + email, not the
          // specific tier — so adding a SECOND tier under the same email doesn't re-send the welcome
          // (and a re-subscribe / duplicate delivery, where the row already exists, doesn't either).
          let alreadyMember = false
          try {
            const { data: existing } = await admin
              .from('memberships')
              .select('id')
              .eq('owner_id', ownerId)
              .eq('client_email', clientEmail)
              .limit(1)
            alreadyMember = !!(existing && existing.length > 0)
          } catch {
            // If the pre-check fails, default to alreadyMember=true so we err on NOT re-emailing.
            alreadyMember = true
          }
          // UPSERT on the unique (tier_id, client_email): a brand-new subscriber inserts; an existing
          // member (e.g. re-subscribing, or a manual grant they're now paying for) updates in place.
          // owner_id is from OUR metadata (set when we created the session), so it's server-authoritative.
          const { error: upErr } = await admin.from('memberships').upsert(
            {
              owner_id: ownerId,
              tier_id: tierId,
              client_email: clientEmail,
              status,
              ...(periodEnd ? { current_period_end: periodEnd } : {}),
              ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
              ...(customerId ? { stripe_customer_id: customerId } : {}),
            },
            { onConflict: 'tier_id,client_email' },
          )
          if (upErr) {
            console.error('[stripe webhook] membership grant upsert failed for session', sessionId, upErr.message)
          } else if (!alreadyMember) {
            // FIRST subscribe only: fire-and-forget a one-click portal welcome to the
            // Stripe-VERIFIED email (clientEmail comes from the signature-verified session —
            // never client-supplied). inviteToPortal is dormant-safe (no service-role → no
            // link; no RESEND_API_KEY → no email) and never throws; the extra .catch() guards
            // the floating promise so it can't affect the webhook's prompt 200.
            void inviteToPortal(clientEmail, {
              nextPath: '/me/memberships',
              intro: "Your membership is active. Here's your private space — courses, downloads and more.",
              nextLabel: 'Open your area',
            }).catch(() => {})
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
      // WORKBOOK purchase (Tuned In, bought on the public site): grant access to the buyer's
      // Stripe-verified email, record the sale, and email them a one-click sign-in link to open
      // it. ownerId comes from OUR metadata (server-authoritative). Idempotent + never throws.
      if (isWorkbook && siteId && sessionId) {
        const ownerId = session.metadata?.ownerId || null
        const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase() || null
        // Which product was bought (defaults to 'tuned-in' for back-compat with sessions
        // created before productSlug existed). Grant access to THAT product only.
        const rawSlug = (session.metadata?.productSlug || 'tuned-in').toLowerCase()
        const productSlug = /^[a-z0-9-]{1,60}$/.test(rawSlug) ? rawSlug : 'tuned-in'
        const productName = session.metadata?.productName || 'Tuned In'
        if (ownerId && email) {
          try {
            const { data: existing } = await admin
              .from('workbook_access')
              .select('owner_id')
              .eq('owner_id', ownerId)
              .eq('slug', productSlug)
              .eq('client_email', email)
              .limit(1)
            if (!existing || existing.length === 0) {
              const { error: accErr } = await admin
                .from('workbook_access')
                .insert({ owner_id: ownerId, slug: productSlug, client_email: email, source: 'purchase' })
              if (accErr) console.error('[stripe webhook] workbook grant failed for session', sessionId, accErr.message)
            }
          } catch (e) {
            console.error('[stripe webhook] workbook grant threw for session', sessionId, e)
          }
          const amountCents = typeof session.amount_total === 'number' ? session.amount_total : 0
          const currency = (session.currency || 'eur').toLowerCase()
          const { error: wbSalesErr } = await admin.from('sales').insert({
            site_id: siteId,
            amount_cents: amountCents,
            currency,
            product: productName,
            customer_email: email,
            stripe_session_id: sessionId,
          })
          if (wbSalesErr && wbSalesErr.code !== '23505') {
            console.error('[stripe webhook] workbook sale insert failed for session', sessionId, wbSalesErr.message)
          }
          void inviteToPortal(email, {
            nextPath: `/me/workbook?w=${encodeURIComponent(productSlug)}`,
            intro: `Your workbook is ready. Here's your private space — open ${productName} whenever you like.`,
            nextLabel: `Open ${productName}`,
          }).catch(() => {})
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
    } else if (event.type === 'customer.subscription.updated') {
      // A paid membership's subscription changed (renewed, went past_due, was set to cancel, etc.).
      // Find the membership by the UNIQUE stripe_subscription_id and sync our status + period end. We
      // do NOT insert here — only an existing (already-granted) row is updated; an unknown id (e.g. a
      // subscription that predates this feature) matches nothing → no-op.
      const sub = event.data.object as Stripe.Subscription
      const status = mapSubStatus(sub.status)
      // .select('id') so a 0-row match is observable (a plain .update reports 0 rows with no error).
      const { data: rows, error: updErr } = await admin
        .from('memberships')
        .update({ status, current_period_end: periodEndIso(sub) })
        .eq('stripe_subscription_id', sub.id)
        .select('id')
      if (updErr) {
        console.error('[stripe webhook] subscription.updated sync failed for', sub.id, updErr.message)
      } else if (!rows || rows.length === 0) {
        // 0 rows = the grant (checkout.session.completed) hasn't linked this subscription id yet
        // (out-of-order delivery). Reconcile from the subscription's OWN metadata (we set
        // kind/tierId/ownerId on subscription_data.metadata) + the customer's email, so the membership
        // lands with the CORRECT status instead of being dropped and later resurrected to 'active'.
        await reconcileMembershipFromSub(admin, sub, status)
      }
    } else if (event.type === 'customer.subscription.deleted') {
      // The subscription ended for good → mark the membership canceled. We KEEP the row for history;
      // gating requires status='active', so a canceled member loses gated-course access automatically.
      const sub = event.data.object as Stripe.Subscription
      const { data: rows, error: delErr } = await admin
        .from('memberships')
        .update({ status: 'canceled', current_period_end: periodEndIso(sub) })
        .eq('stripe_subscription_id', sub.id)
        .select('id')
      if (delErr) {
        console.error('[stripe webhook] subscription.deleted sync failed for', sub.id, delErr.message)
      } else if (!rows || rows.length === 0) {
        // 0 rows: deleted arrived before the grant linked the id. Reconcile a canceled row so a
        // late-arriving grant (which now also reads the true status) can't open access.
        await reconcileMembershipFromSub(admin, sub, 'canceled')
      }
    }
  } catch {
    // Never surface an error to Stripe (it would retry); the signature was already verified.
  }

  return NextResponse.json({ received: true })
}
