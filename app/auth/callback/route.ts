import { NextResponse, type NextRequest } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Magic-link / OAuth return point. Magic links arrive in one of TWO shapes and we
// must handle BOTH or sign-in silently bounces back to login:
//   • token_hash + type  → email-template / admin-generated links; verifyOtp, and
//                            crucially it needs NO PKCE code_verifier (works across
//                            devices / when the verifier cookie is absent).
//   • code               → browser-initiated PKCE links (signInWithOtp); exchange.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  // Behind a reverse proxy (Coolify/Traefik) request.url is the app's internal
  // address (0.0.0.0:3000). Use the forwarded headers to get the real public
  // origin so redirects land on the right domain.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  const supabase = createSupabaseServerClient()
  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }
  if (ok) return NextResponse.redirect(`${base}${next}`)

  // On failure (expired/reused link), keep CLIENTS in their branded portal rather
  // than dumping them on the owner login. `next` is a relative path we set.
  const failPath = next.startsWith('/me') ? '/me?error=link' : '/login?error=link'
  return NextResponse.redirect(`${base}${failPath}`)
}
