export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// PIN sign-in for the standalone planner: email + 6-digit PIN → signInWithPassword, which
// sets the session cookie on this response (same origin), so /api/planner then authenticates.
export async function POST(req: NextRequest) {
  let body: { email?: string; pin?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const email = String(body?.email ?? '').trim().toLowerCase()
  const pin = String(body?.pin ?? '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter your email and 6-digit PIN.' }, { status: 400 })
  }
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
  if (error) return NextResponse.json({ error: 'That email + PIN didn’t match.' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
