export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Cross-device sync for the standalone planner. Same origin as the portal, so the login
// session cookie authenticates the caller (getCurrentUser). Each person reads/writes only
// their own row (RLS). GET → their blob; POST → save their blob.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ signedIn: false }, { status: 401 })
  const sb = createSupabaseServerClient()
  const { data, error } = await sb.from('planner_data').select('data, updated_at').eq('user_id', user.id).maybeSingle()
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    signedIn: true,
    email: user.email ?? '',
    data: (data?.data as unknown) ?? null,
    updatedAt: (data?.updated_at as string) ?? null,
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  let body: { data?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const data = body?.data
  if (data == null || typeof data !== 'object') return NextResponse.json({ error: 'bad data' }, { status: 400 })
  if (JSON.stringify(data).length > 3_000_000) return NextResponse.json({ error: 'too large' }, { status: 413 })

  const sb = createSupabaseServerClient()
  const { error } = await sb.from('planner_data').upsert(
    { user_id: user.id, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() })
}
