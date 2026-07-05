export const runtime = 'nodejs'

import { getCurrentUser } from '@/lib/auth'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getMyWorkbookHtml } from '@/lib/portal/workbook'

// A small branded fallback page (shown when not signed in or not entitled).
function message(title: string, body: string, status: number): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#1A1108;color:#E8C5B0;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}div{max-width:22rem}h1{font-weight:400;font-size:1.3rem;margin:0 0 .8rem}p{opacity:.72;font-size:.92rem;line-height:1.65;margin:0}</style></head><body><div><h1>${title}</h1><p>${body}</p></div></body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}

// Serves the workbook HTML — but ONLY to a signed-in, entitled member. The RPC
// re-checks entitlement server-side on every request (the iframe src can't be
// cached past a session), so this can't be scraped by a logged-out visitor.
export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) {
    return message('Please sign in', 'Sign in to your portal to open your workbook.', 401)
  }
  // Which product to serve (?w=<slug>); defaults to the original 'tuned-in'.
  const raw = (new URL(req.url).searchParams.get('w') || 'tuned-in').toLowerCase()
  const workbookSlug = /^[a-z0-9-]{1,60}$/.test(raw) ? raw : 'tuned-in'
  const html = await getMyWorkbookHtml(PORTAL_SITE_SLUG, workbookSlug)
  if (!html) {
    return message(
      'Not unlocked yet',
      'This workbook isn’t on your account yet. If you bought it, make sure you’re signed in with the email you used at checkout.',
      403,
    )
  }
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      // Allow embedding only within our own portal page (same-origin iframe).
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  })
}
