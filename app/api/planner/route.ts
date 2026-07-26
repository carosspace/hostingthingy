export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { plannerEntitled } from '@/lib/portal/planner-access'

// Cross-device sync for the standalone planner. Same origin as the portal, so the login
// session cookie authenticates the caller (getCurrentUser). Each person reads/writes only
// their own row (RLS). GET → their blob; POST → save their blob. The planner is a PAID
// product: only buyers (or the owner) may sync — non-buyers get entitled:false and can't POST.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ signedIn: false }, { status: 401 })
  const entitled = await plannerEntitled(user)
  // Signed in but hasn't bought → tell the app to show its unlock screen; no data, no sync.
  if (!entitled) return NextResponse.json({ signedIn: true, entitled: false, email: user.email ?? '' })
  const sb = createSupabaseServerClient()
  const { data, error } = await sb.from('planner_data').select('data, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    signedIn: true,
    entitled: true,
    email: user.email ?? '',
    data: (data?.data as unknown) ?? null,
    updatedAt: (data?.updated_at as string) ?? null,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  // Paid-product gate: only a buyer (or the owner) may back up / sync.
  if (!(await plannerEntitled(user))) return NextResponse.json({ error: 'not_entitled' }, { status: 403 })
  let body: { data?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const data = body?.data
  if (data == null || typeof data !== 'object') return NextResponse.json({ error: 'bad data' }, { status: 400 })
  if (JSON.stringify(data).length > 3_000_000) return NextResponse.json({ error: 'too large' }, { status: 413 })

  const sb = createSupabaseServerClient()
  const { error } = await sb.from('planner_data').upsert(
    { user_id: user.id, email: user.email ?? null, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() })
}
