import { headers } from 'next/headers'

// The public origin for absolute URLs (sitemap, robots, JSON-LD). Derives from the
// real request host so it's correct on app.animatemple.com AND any future custom
// domain — regardless of a stale NEXT_PUBLIC_SITE_URL. Falls back to env / canonical.
export function siteBaseUrl(): string {
  const bad = /localhost|127\.0\.0\.1|placeholder|\.local(\b|$)/i
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    if (host && !bad.test(host)) {
      const proto = h.get('x-forwarded-proto') || 'https'
      return `${proto}://${host.split(',')[0].trim()}`
    }
  } catch {
    // called outside a request context — fall through
  }
  const env = process.env.NEXT_PUBLIC_SITE_URL
  if (env && !bad.test(env)) return env.replace(/\/+$/, '')
  return 'https://app.animatemple.com'
}
