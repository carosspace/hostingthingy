import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()

  // Behind a reverse proxy, derive the public origin from forwarded headers
  // (request.url would otherwise be the app's internal 0.0.0.0:3000 address).
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const base = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin

  // 303 so the browser follows with a GET.
  return NextResponse.redirect(`${base}/login`, { status: 303 })
}
