import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { emailConfigured, sendEmail } from '@/lib/email'
import { portalAccessLink } from '@/lib/portal/invite'
import { buildAppointmentIcs, appointmentUtcRange } from './ics'
import { formatDayLabel, formatTimeLabel } from './types'

// Orchestrates booking emails: a warm confirmation to the CLIENT (with a one-tap .ics
// calendar invite) and a short notification to the OWNER. Loads everything it needs via the
// SERVICE-ROLE admin client (no user session) — the appointment, the owner's email from
// auth.users, and the owner's timezone from booking_settings.
//
// SERVER-ONLY (admin client + the Resend secret). Fully DORMANT-SAFE: every entry point
// no-ops when email is unconfigured, and ALL errors are swallowed (never thrown). A failed
// email must NEVER break the payment / confirm path that called it.

interface LoadedAppointment {
  id: string
  ownerId: string
  serviceName: string | null
  clientName: string | null
  clientEmail: string | null
  slotDate: string | null
  slotTime: string | null
  durationMin: number | null
  note: string | null
  status: string
  ownerEmail: string | null
  ownerName: string | null
  timezone: string
}

// Load the appointment + the owner's email (auth.users) + the owner's timezone. Returns null
// on any miss (no admin client, row not found, etc.). Never throws.
async function load(appointmentId: string): Promise<LoadedAppointment | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    const { data: ap, error } = await admin
      .from('appointments')
      .select('id, owner_id, service_name, client_name, client_email, slot_date, slot_time, duration_min, note, status')
      .eq('id', appointmentId)
      .maybeSingle()
    if (error || !ap) return null

    // Owner timezone (defaults to UTC if no settings row).
    let timezone = 'UTC'
    try {
      const { data: settings } = await admin
        .from('booking_settings')
        .select('timezone')
        .eq('owner_id', ap.owner_id)
        .maybeSingle()
      if (settings?.timezone) timezone = settings.timezone
    } catch {
      /* keep UTC */
    }

    // Owner email from auth.users (service-role admin API).
    let ownerEmail: string | null = null
    let ownerName: string | null = null
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(ap.owner_id)
      ownerEmail = userRes?.user?.email ?? null
      const meta = (userRes?.user?.user_metadata ?? {}) as Record<string, unknown>
      const n = meta.name ?? meta.full_name
      ownerName = typeof n === 'string' && n.trim() ? n.trim() : null
    } catch {
      /* no owner email -> owner notification simply won't send */
    }

    return {
      id: String(ap.id),
      ownerId: String(ap.owner_id),
      serviceName: ap.service_name ?? null,
      clientName: ap.client_name ?? null,
      clientEmail: ap.client_email ?? null,
      slotDate: ap.slot_date ?? null,
      slotTime: ap.slot_time ?? null,
      durationMin: ap.duration_min ?? null,
      note: ap.note ?? null,
      status: String(ap.status),
      ownerEmail,
      ownerName,
      timezone,
    }
  } catch {
    return null
  }
}

// Minimal HTML escape for values interpolated into the email bodies.
function esc(s: string | null | undefined): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// "Mon 22 Jun · 2:00 PM (Europe/Lisbon)" for a slot, in the owner's timezone.
function whenLabel(a: LoadedAppointment): string {
  if (!a.slotDate || !a.slotTime) return ''
  const day = formatDayLabel(a.slotDate)
  const time = formatTimeLabel(a.slotTime)
  return `${day} · ${time} (${a.timezone})`
}

// Build the .ics for a slotted appointment, or null when there's no concrete slot (e.g. a
// free "preferred time" request with no chosen slot yet — nothing to put on a calendar).
function buildIcs(a: LoadedAppointment): { content: string; filename: string } | null {
  if (!a.slotDate || !a.slotTime) return null
  if (!a.ownerEmail || !a.clientEmail) return null
  const { startUtc, endUtc } = appointmentUtcRange(a.slotDate, a.slotTime, a.durationMin ?? 60, a.timezone)
  const title = a.serviceName ? `${a.serviceName}` : 'Booking'
  const content = buildAppointmentIcs({
    uid: `appointment-${a.id}@animatemple.com`,
    title,
    description: a.note ? `Note: ${a.note}` : `Your booking: ${title}`,
    startUtc,
    endUtc,
    organizerEmail: a.ownerEmail,
    organizerName: a.ownerName ?? undefined,
    attendeeEmail: a.clientEmail,
    attendeeName: a.clientName ?? undefined,
  })
  return { content, filename: 'booking.ics' }
}

// Send the confirmation (to client) + notification (to owner) for a CONFIRMED booking.
// No-op when email is unconfigured. Swallows every error — never throws.
export async function notifyBookingConfirmed(appointmentId: string): Promise<void> {
  if (!emailConfigured()) return
  try {
    const a = await load(appointmentId)
    if (!a) return

    const service = a.serviceName || 'your session'
    const when = whenLabel(a)
    const ics = buildIcs(a)

    // (a) CLIENT confirmation — warm, with the calendar invite attached.
    if (a.clientEmail) {
      // Fold a one-click "manage in your member area" link into THIS single email (no second
      // send). The link is minted only for a.clientEmail — the address STORED on the
      // appointment, never client-supplied at send time. Dormant-safe: portalAccessLink
      // returns null without a service-role key, and we then simply omit the button.
      const portalLink = await portalAccessLink(a.clientEmail, '/me/bookings')
      const portalButton = portalLink
        ? `<p style="margin:20px 0">` +
          `<a href="${portalLink}" ` +
          `style="display:inline-block;padding:10px 20px;background:#c8a96a;color:#fff;` +
          `text-decoration:none;border-radius:6px;font-family:Helvetica,Arial,sans-serif;` +
          `font-weight:600">Manage this booking in your member area</a>` +
          `</p>`
        : ''
      const html =
        `<div style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6">` +
        `<p>Hi ${esc(a.clientName) || 'there'},</p>` +
        `<p>Your booking is confirmed. Here are the details:</p>` +
        `<p style="margin:16px 0;padding:14px 18px;background:#faf7f0;border-left:3px solid #c8a96a">` +
        `<strong>${esc(service)}</strong><br/>` +
        (when ? `${esc(when)}<br/>` : '') +
        (a.note ? `<span style="color:#666">“${esc(a.note)}”</span>` : '') +
        `</p>` +
        `<p>A calendar invite is attached — open it to add this to your calendar.</p>` +
        portalButton +
        `<p>With warmth,<br/>${esc(a.ownerName) || 'Anima Temple'}</p>` +
        `</div>`
      const text =
        `Hi ${a.clientName || 'there'},\n\n` +
        `Your booking is confirmed.\n\n` +
        `${service}\n${when}\n` +
        (a.note ? `Note: ${a.note}\n` : '') +
        `\nA calendar invite is attached.\n`
      await sendEmail({
        to: a.clientEmail,
        subject: `Confirmed: ${service}${when ? ` — ${when}` : ''}`,
        html,
        text,
        ...(ics ? { icsContent: ics.content, icsFilename: ics.filename } : {}),
      })
    }

    // (b) OWNER notification — short, same invite attached.
    if (a.ownerEmail) {
      const html =
        `<div style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6">` +
        `<p>New booking: <strong>${esc(service)}</strong> with <strong>${esc(a.clientName) || 'a client'}</strong>` +
        (when ? ` on ${esc(when)}` : '') +
        `.</p>` +
        `<p style="color:#666">${esc(a.clientEmail)}${a.note ? ` · “${esc(a.note)}”` : ''}</p>` +
        `</div>`
      const text =
        `New booking: ${service} with ${a.clientName || 'a client'}${when ? ` on ${when}` : ''}.\n` +
        `${a.clientEmail || ''}${a.note ? ` · ${a.note}` : ''}\n`
      await sendEmail({
        to: a.ownerEmail,
        subject: `New booking: ${service}${a.clientName ? ` with ${a.clientName}` : ''}`,
        html,
        text,
        ...(ics ? { icsContent: ics.content, icsFilename: ics.filename } : {}),
      })
    }
  } catch {
    // Swallow — a failed email must never break the confirm/payment path.
  }
}

// Send a "request received" (client) + "new request to confirm" (owner) pair for a NEW
// FREE booking request that still awaits owner confirmation. No .ics yet (not confirmed).
// No-op when email is unconfigured. Swallows every error — never throws.
export async function notifyBookingRequested(appointmentId: string): Promise<void> {
  if (!emailConfigured()) return
  try {
    const a = await load(appointmentId)
    if (!a) return

    const service = a.serviceName || 'your session'
    const when = whenLabel(a)

    // (a) CLIENT — request received.
    if (a.clientEmail) {
      const html =
        `<div style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6">` +
        `<p>Hi ${esc(a.clientName) || 'there'},</p>` +
        `<p>We've received your booking request for <strong>${esc(service)}</strong>` +
        (when ? ` (${esc(when)})` : '') +
        `. You'll get a confirmation once it's approved.</p>` +
        `<p>With warmth,<br/>${esc(a.ownerName) || 'Anima Temple'}</p>` +
        `</div>`
      await sendEmail({
        to: a.clientEmail,
        subject: `Request received: ${service}`,
        html,
        text: `Hi ${a.clientName || 'there'},\n\nWe've received your booking request for ${service}${when ? ` (${when})` : ''}. You'll get a confirmation once it's approved.\n`,
      })
    }

    // (b) OWNER — new request to confirm.
    if (a.ownerEmail) {
      const html =
        `<div style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6">` +
        `<p>New booking request to confirm: <strong>${esc(service)}</strong> from <strong>${esc(a.clientName) || 'a client'}</strong>` +
        (when ? ` on ${esc(when)}` : '') +
        `.</p>` +
        `<p style="color:#666">${esc(a.clientEmail)}${a.note ? ` · “${esc(a.note)}”` : ''}</p>` +
        `</div>`
      await sendEmail({
        to: a.ownerEmail,
        subject: `New booking request: ${service}${a.clientName ? ` from ${a.clientName}` : ''}`,
        html,
        text: `New booking request to confirm: ${service} from ${a.clientName || 'a client'}${when ? ` on ${when}` : ''}.\n${a.clientEmail || ''}${a.note ? ` · ${a.note}` : ''}\n`,
      })
    }
  } catch {
    // Swallow — never break the request path.
  }
}
