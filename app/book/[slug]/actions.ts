'use server'

import { redirect } from 'next/navigation'
import {
  requestBooking,
  requestBookingSlot,
  requestBookingSlotPending,
  attachBookingSession,
  getBookingServices,
} from '@/lib/bookings/repo'
import { getCheckoutSite } from '@/lib/sites/public'
import { createConnectCheckout, createDirectCheckout, stripeConfigured } from '@/lib/stripe'
import { siteBaseUrl } from '@/lib/sites/baseurl'
import { formatDayLabel, formatTimeLabel } from '@/lib/bookings/types'

export async function requestBookingAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return
  const serviceId = String(formData.get('serviceId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const when = String(formData.get('when') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!serviceId || !name || !email) {
    redirect(`/book/${slug}?error=1`)
  }

  await requestBooking({ slug, serviceId, name, email, when, note })
  redirect(`/book/${slug}?sent=1`)
}

// What the slot-booking form gets back. For a FREE service this mirrors the old behaviour
// (the client navigates to the matching ?sent / ?error URL). For a PAID service we return a
// Stripe Checkout URL the client redirects to; the appointment is held as pending_payment and
// is only confirmed once the webhook sees the payment succeed.
export type BookingSlotResult =
  | { ok: true }
  | { checkoutUrl: string }
  | { error: 'taken' | 'invalid' | 'failed' | 'payments_off' }

export async function requestBookingSlotAction(formData: FormData): Promise<BookingSlotResult> {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return { error: 'invalid' }
  const serviceId = String(formData.get('serviceId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const slotDate = String(formData.get('slotDate') ?? '').trim()
  const slotTime = String(formData.get('slotTime') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!serviceId || !name || !email || !slotDate || !slotTime) {
    return { error: 'invalid' }
  }

  // Resolve the chosen service's price/currency/name SERVER-SIDE from the OWNER's public,
  // owner-scoped service list (never from the page payload) — and do it INDEPENDENTLY of payment
  // config, so a PRICED service can never be silently booked for free.
  const services = await getBookingServices(slug)
  const chosen = services.find(s => s.serviceId === serviceId)
  const priceCents = chosen?.priceCents || 0
  const currency = chosen?.currency || 'eur'
  const serviceName = chosen?.name || 'Booking'
  const isPriced = priceCents > 0

  if (isPriced) {
    // A priced service MUST be charged up-front. If payments can't run — Stripe not configured, or
    // the site won't load — BLOCK rather than fall through to the free confirm flow. The visitor was
    // told payment is due, and the owner must not receive a priced slot for nothing.
    if (!stripeConfigured()) return { error: 'payments_off' }
    const site = await getCheckoutSite(slug)
    if (!site) return { error: 'failed' }

    // Hold the slot first (pending_payment) through the SAME double-booking-guarded RPC. If the
    // slot is taken we must NOT create a checkout.
    const held = await requestBookingSlotPending({ slug, serviceId, name, email, slotDate, slotTime, note })
    if (held.status === 'taken') return { error: 'taken' }
    if (held.status !== 'ok') return { error: 'failed' }
    const appointmentId = held.appointmentId

    const base = siteBaseUrl()
    const bookUrl = `${base}/book/${slug}`
    const productName = `${serviceName} — ${formatDayLabel(slotDate)} ${formatTimeLabel(slotTime)}`.slice(0, 250)
    const metadata = { kind: 'booking', appointmentId, siteId: site.id, productName }
    const successUrl = `${bookUrl}?sent=1`
    const cancelUrl = `${bookUrl}?error=cancelled`

    // Same direct-vs-connect branch as the Pay button: a site with its own charges-enabled
    // connected account is the merchant of record; otherwise charge the platform account.
    const useConnect = !!(site.stripeAccountId && site.stripeChargesEnabled)
    const checkoutUrl = useConnect
      ? await createConnectCheckout({
          accountId: site.stripeAccountId as string,
          amountCents: priceCents,
          currency,
          productName,
          customerEmail: email || undefined,
          successUrl,
          cancelUrl,
          metadata,
        })
      : await createDirectCheckout({
          amountCents: priceCents,
          currency,
          productName,
          customerEmail: email || undefined,
          successUrl,
          cancelUrl,
          metadata,
        })

    if (!checkoutUrl) {
      // Couldn't start a checkout (e.g. transient Stripe error). The hold stays pending_payment
      // (the webhook never confirms it); surface a generic failure to the visitor.
      return { error: 'failed' }
    }

    // Persist the session id for idempotency + traceability. Best-effort — the webhook can also
    // match by metadata.appointmentId, so a false here is non-fatal.
    const sessionId = sessionIdFromCheckoutUrl(checkoutUrl)
    if (sessionId) await attachBookingSession(slug, appointmentId, sessionId)

    return { checkoutUrl }
  }

  // FREE service (price_cents = 0): the existing request -> owner-confirm flow, unchanged.
  const result = await requestBookingSlot({ slug, serviceId, name, email, slotDate, slotTime, note })
  if (result === 'taken') return { error: 'taken' }
  if (result === 'error') return { error: 'failed' }
  return { ok: true }
}

// The Checkout URL ends with .../c/pay/cs_test_...#... — pull the cs_ session id from it so we
// can store it on the appointment without expanding the session. Returns null if not found.
function sessionIdFromCheckoutUrl(url: string): string | null {
  const m = url.match(/(cs_[A-Za-z0-9_]+)/)
  return m ? m[1] : null
}
