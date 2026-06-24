import { Resend } from 'resend'

// Transactional email sender (booking confirmations + owner notifications).
//
// SERVER-ONLY. RESEND_API_KEY is read here and must NEVER reach the client — do not
// import this from a Client Component.
//
// FAIL-SAFE + fully DORMANT until configured, mirroring lib/stripe.ts: with no
// RESEND_API_KEY, `emailConfigured()` is false, `getResend()` returns null, and
// `sendEmail()` no-ops (returns false) instead of throwing. Nothing here throws at
// import time or at call time. A failed send NEVER bubbles up — it returns false and
// logs a console.warn — so an email problem can never break a payment, a webhook 200,
// or a confirm action. Once RESEND_API_KEY is set, the same helper does the real work.

// True only when the Resend API key is present. Drives the dormant behaviour.
export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

// The verified "From" address. Configurable via BOOKING_FROM_EMAIL; the default is a
// sensible placeholder (must be a Resend-verified sender to actually deliver).
function fromAddress(): string {
  return process.env.BOOKING_FROM_EMAIL || 'Anima Temple <bookings@animatemple.com>'
}

// Lazily build (and reuse) the Resend client. Returns null when unconfigured so callers
// degrade gracefully. Built only once configured, so the module stays inert without a key.
let cached: Resend | null = null
function getResend(): Resend | null {
  if (!emailConfigured()) return null
  if (!cached) cached = new Resend(process.env.RESEND_API_KEY as string)
  return cached
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text?: string
  // When given, attached as a text/calendar (.ics) calendar invite.
  icsContent?: string
  icsFilename?: string
}

// Send one email via Resend. Returns true on success, false when unconfigured / on any
// error. NEVER throws — a failed email must not break the caller. Logs real send errors
// (console.warn) so a delivery problem stays observable; a dormant no-op is silent.
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const resend = getResend()
  if (!resend) return false
  if (!input.to) return false

  try {
    const attachments =
      input.icsContent != null
        ? [
            {
              filename: input.icsFilename || 'invite.ics',
              // Resend accepts a base64 string OR a Buffer for `content`. A Buffer keeps
              // the raw bytes intact; the content type marks it as a calendar invite so
              // mail clients offer "Add to calendar".
              content: Buffer.from(input.icsContent, 'utf-8'),
              contentType: 'text/calendar; method=PUBLISH; charset=UTF-8',
            },
          ]
        : undefined

    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(attachments ? { attachments } : {}),
    })

    if (error) {
      console.warn('[email] send failed:', error.message || error)
      return false
    }
    return true
  } catch (err) {
    console.warn('[email] send threw:', err instanceof Error ? err.message : String(err))
    return false
  }
}
