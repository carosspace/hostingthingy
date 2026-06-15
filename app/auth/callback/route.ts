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

  return NextResponse.redirect(`${base}/login?error=link`)
}
