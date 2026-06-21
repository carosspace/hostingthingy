import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hosts that are the platform itself (dashboard + /s/ sites + marketing), never a
// customer's site. Everything else is treated as a possible custom domain.
// Only the editor/dashboard host is the platform. The apex (animatemple.com) +
// www are a CUSTOMER SITE — the owner's own published site has domain
// 'animatemple.com', so they must flow through the custom-domain routing below,
// NOT be short-circuited here. (Other users can't claim the apex: setDomainAction
// blocks it.)
const PLATFORM_HOSTS = new Set(['app.animatemple.com', 'localhost', '127.0.0.1'])

// Best-effort in-memory cache so a custom domain doesn't hit the DB every request.
const domainCache = new Map<string, { slug: string | null; exp: number }>()

async function lookupDomainSlug(host: string): Promise<string | null> {
  const now = Date.now()
  const hit = domainCache.get(host)
  if (hit && hit.exp > now) return hit.slug
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let slug: string | null = null
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/get_site_by_domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ p_host: host }),
        signal: AbortSignal.timeout(2500), // never let a hung DB stall the request
      })
      if (res.ok) {
        const rows = await res.json()
        const row = Array.isArray(rows) ? rows[0] : rows
        if (row && row.status === 'live' && row.slug) slug = String(row.slug)
      }
    } catch {
      // DB unreachable / function not migrated — treat as no mapping
    }
  }
  // Cache hits longer than misses; misses stay short so a freshly-added domain appears soon.
  if (domainCache.size > 5000) domainCache.clear() // bound memory vs. random Host spraying
  domainCache.set(host, { slug, exp: now + (slug ? 60_000 : 15_000) })
  return slug
}

export async function middleware(request: NextRequest) {
  // Behind Coolify/Traefik the real client host arrives in x-forwarded-host (same as
  // lib/sites/baseurl.ts); fall back to Host. Strip any port and take the first value.
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .toLowerCase()
    .split(',')[0]
    .trim()
    .split(':')[0]
  const path = request.nextUrl.pathname

  // --- Custom-domain routing -------------------------------------------------
  // For a non-platform host, serve the site that owns that domain. The platform
  // host short-circuits before any lookup, so app.animatemple.com is untouched.
  const isReserved =
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/s/') ||
    path === '/robots.txt' ||
    path === '/sitemap.xml' ||
    /\.[a-z0-9]+$/i.test(path) // any file with an extension (assets)
  if (host && !PLATFORM_HOSTS.has(host) && !isReserved) {
    const slug = await lookupDomainSlug(host)
    if (slug) {
      const url = request.nextUrl.clone()
      url.pathname = path === '/' ? `/s/${slug}` : `/s/${slug}${path}`
      return NextResponse.rewrite(url)
    }
    // Unknown custom host → fall through to normal handling (it'll 404).
  }

  // --- Auth session refresh (portal only) ------------------------------------
  if (path.startsWith('/dashboard') || path.startsWith('/account') || path === '/login' || path === '/me' || path.startsWith('/me/')) {
    let response = NextResponse.next({ request })
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    await supabase.auth.getUser()
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals + static assets (so custom domains can
  // be routed on any path), but NOT on /api (the Divine Blueprint API stays untouched).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
