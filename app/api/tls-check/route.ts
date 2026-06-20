import { NextResponse } from 'next/server'
import { liveSiteSlugForDomain } from '@/lib/sites/public'

export const dynamic = 'force-dynamic'

// On-demand-TLS authorization endpoint. A reverse proxy configured for on-demand
// certificates (e.g. Caddy `on_demand_tls.ask`) calls this BEFORE issuing a cert for
// an incoming domain: 200 = allowed, anything else = refused. This is what makes
// custom-domain HTTPS keyless + self-serve — no per-domain proxy config, no secrets
// in the app. We only allow the platform host and domains a real site has claimed,
// so the proxy never issues certs for domains we don't serve.
export async function GET(request: Request) {
  const domain = (new URL(request.url).searchParams.get('domain') || '').toLowerCase().trim().replace(/\.$/, '')
  if (!domain) return new NextResponse('missing domain', { status: 400 })
  if (domain === 'app.animatemple.com' || domain === 'animatemple.com' || domain === 'www.animatemple.com') {
    return new NextResponse('ok', { status: 200 })
  }
  try {
    const slug = await liveSiteSlugForDomain(domain) // only authorize domains we actually serve (live)
    return slug ? new NextResponse('ok', { status: 200 }) : new NextResponse('unknown domain', { status: 404 })
  } catch {
    return new NextResponse('error', { status: 503 })
  }
}
