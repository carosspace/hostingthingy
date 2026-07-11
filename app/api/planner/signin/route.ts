export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Send a magic sign-in link for the standalone planner. Reuses the portal's OTP flow, but
// routes back to the planner (/auth/callback → /planner3/). Auto-creates an account for a
// new email (same "sign in with your email" model as the client portal). Works across
// devices — the callback handles the link without a PKCE verifier cookie.
const APP = (process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.animatemple.com').replace(/\/+$/, '')

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
  }
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${APP}/auth/callback?next=${encodeURIComponent('/planner3/')}` },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
