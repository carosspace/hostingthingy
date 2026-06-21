import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Magic-link / OAuth return point. Supabase redirects here with a `code`, which
// we exchange for a session cookie, then send the visitor into the portal.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Behind a reverse proxy (Coolify/Traefik) request.url is the app's internal
  // address (0.0.0.0:3000). Use the forwarded headers to get the real public
  // origin so redirects land on the right domain.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${base}${next}`)
  }

  // On failure (expired/reused link), keep CLIENTS in their branded portal rather
  // than dumping them on the owner login. `next` is a relative path we set.
  const failPath = next.startsWith('/me') ? '/me?error=link' : '/login?error=link'
  return NextResponse.redirect(`${base}${failPath}`)
}
