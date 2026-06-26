import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { emailConfigured, sendEmail } from '@/lib/email'
import { siteBaseUrl } from '@/lib/sites/baseurl'
import { getPortalSite } from '@/lib/portal/site'

// Auto-invite a paying client into their branded member area (the /me portal).
//
// SERVER-ONLY. Uses the SERVICE-ROLE admin client (createUser + generateLink) and the
// Resend secret — must NEVER be imported into a Client Component, and the minted
// action_link (a one-click sign-in) is sent ONLY by email, never returned to a browser.
//
// SECURITY: a magic link LOGS THE RECIPIENT IN. Every caller must pass the email that
// was VERIFIED at checkout (the signature-verified Stripe session) or the booking's
// stored client_email — NEVER an arbitrary / client-supplied address. The link is
// generated for, and emailed to, that one address only.
//
// Fully DORMANT-SAFE and best-effort: with no service-role key there's no link; with no
// RESEND_API_KEY there's no email; both cases no-op. Nothing here ever throws, so it can
// be fire-and-forgotten from a webhook / booking path without delaying or breaking it.

// Mint a one-click sign-in link that, when opened, signs `email` in and lands them on
// `nextPath` inside the portal. Returns null when dormant (no service-role key) or on any
// error — the caller then simply doesn't send a login button. NEVER throws.
export async function portalAccessLink(email: string, nextPath = '/me'): Promise<string | null> {
  const clean = (email || '').trim()
  if (!clean || !clean.includes('@')) return null
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    // Step 1 — silently ensure a passwordless account exists for this email. If they
    // already exist, Supabase errors with a duplicate/"already registered" — that's the
    // expected case for a returning buyer; ignore it and carry on to the link step. Any
    // other createUser hiccup is non-fatal too.
    try {
      const { error: createError } = await admin.auth.admin.createUser({
        email: clean,
        email_confirm: true,
      })
      if (createError) {
        console.error('[portal-invite] createUser (ignored):', createError.message)
      }
    } catch (e) {
      console.error('[portal-invite] createUser threw (ignored):', e)
    }

    // Step 2 — mint the magic link. redirectTo points at our auth callback, which
    // exchanges the link for a session and then redirects to `nextPath`.
    const redirectTo = `${siteBaseUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: clean,
      options: { redirectTo },
    })
    if (error) {
      console.error('[portal-invite] generateLink failed:', error.message)
      return null
    }
    return data?.properties?.action_link ?? null
  } catch (e) {
    console.error('[portal-invite] threw:', e)
    return null
  }
}

// Minimal HTML escape for values interpolated into the email body.
function esc(s: string | null | undefined): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PortalWelcomeOpts {
  // The portal brand label (e.g. "Anima Temple"), used in the subject + body.
  brand: string
  // The minted one-click sign-in link, or null. When null this is a no-op (no email
  // with a dead button is ever sent).
  link: string | null
  // A short, warm line explaining why they're getting access (membership active, etc.).
  intro: string
  // The call-to-action button label (e.g. "Open your area").
  nextLabel: string
}

// Send the branded "your space is ready" welcome email carrying the one-click sign-in
// button. No-op when email is unconfigured OR there's no link. Swallows every error —
// never throws.
export async function sendPortalWelcome(email: string, opts: PortalWelcomeOpts): Promise<void> {
  if (!emailConfigured()) return
  if (!opts.link) return
  const to = (email || '').trim()
  if (!to) return

  try {
    const brand = esc(opts.brand) || 'Anima Temple'
    const intro = esc(opts.intro)
    const label = esc(opts.nextLabel) || 'Open your area'
    const link = opts.link // href only — never shown as text (keeps the long token out of view)

    const html =
      `<div style="font-family:Georgia,serif;color:#2b2b2b;line-height:1.6;max-width:520px">` +
      `<p>Welcome to ${brand} — your space is ready.</p>` +
      (intro ? `<p>${intro}</p>` : '') +
      `<p style="margin:24px 0">` +
      `<a href="${link}" ` +
      `style="display:inline-block;padding:12px 24px;background:#c8a96a;color:#fff;` +
      `text-decoration:none;border-radius:6px;font-family:Helvetica,Arial,sans-serif;` +
      `font-weight:600">${label}</a>` +
      `</p>` +
      `<p style="color:#888;font-size:13px">This is a one-click sign-in link just for you — ` +
      `please don't forward it. If the button doesn't work, reply and we'll help.</p>` +
      `<p style="color:#666">With warmth,<br/>${brand}</p>` +
      `</div>`

    const text =
      `Welcome to ${opts.brand} — your space is ready.\n\n` +
      (opts.intro ? `${opts.intro}\n\n` : '') +
      `${opts.nextLabel}: ${link}\n\n` +
      `This is a one-click sign-in link just for you — please don't forward it.\n`

    await sendEmail({
      to,
      subject: `Welcome to ${opts.brand} — your space is ready`,
      html,
      text,
    })
  } catch {
    // Swallow — a failed welcome email must never break the payment / booking path.
  }
}

export interface InviteToPortalOpts {
  // Where to land them after sign-in (e.g. '/me/memberships'). Defaults to '/me'.
  nextPath?: string
  // The warm line for the email body.
  intro: string
  // The CTA button label.
  nextLabel: string
}

// Convenience: mint the link for `email` + send the branded welcome, using the portal's
// own brand. SERVER-ONLY, fully dormant-safe, NEVER throws — safe to fire-and-forget.
//
// SECURITY: `email` MUST be the Stripe-verified / booking-stored address (see file header).
export async function inviteToPortal(email: string, opts: InviteToPortalOpts): Promise<void> {
  try {
    const nextPath = opts.nextPath || '/me'
    const link = await portalAccessLink(email, nextPath)
    let brand = 'Anima Temple'
    try {
      const portal = await getPortalSite()
      brand = portal.brand || brand
    } catch {
      // keep the neutral default brand
    }
    await sendPortalWelcome(email, {
      brand,
      link,
      intro: opts.intro,
      nextLabel: opts.nextLabel,
    })
  } catch {
    // Swallow — never break the caller (a webhook 200 / booking flow).
  }
}
