export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Set/change the signed-in person's 6-digit sign-in PIN (stored as their Supabase password,
// hashed at rest). Used by the member dashboard + the planner. Must already be signed in.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  let body: { pin?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const pin = String(body?.pin ?? '')
  if (!/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'Choose a 6-digit PIN.' }, { status: 400 })
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({ password: pin })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
