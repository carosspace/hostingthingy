export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMyWorkbook } from '@/lib/portal/workbook'

const MAX = 2_000_000 // ~2MB of written answers per workbook — far beyond any real use

function slugOf(req: NextRequest): string | null {
  const raw = (new URL(req.url).searchParams.get('w') || '').toLowerCase().trim()
  return /^[a-z0-9-]{1,60}$/.test(raw) ? raw : null
}

// Save what the member has written in ONE workbook. Entitlement is re-checked server-side:
// only someone who actually owns the workbook can store state against it. RLS then keeps the
// row to their own user_id, so nobody can write into someone else's workbook.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  const slug = slugOf(req)
  if (!slug) return NextResponse.json({ error: 'bad workbook' }, { status: 400 })

  const wb = await getMyWorkbook(PORTAL_SITE_SLUG, slug)
  if (!wb?.entitled) return NextResponse.json({ error: 'not_entitled' }, { status: 403 })

  let body: { data?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const raw = body?.data
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'bad data' }, { status: 400 })
  }
  // Only string→string pairs (localStorage's own shape); drop anything else.
  const data: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') data[k] = v
  }
  if (JSON.stringify(data).length > MAX) return NextResponse.json({ error: 'too large' }, { status: 413 })

  const sb = createSupabaseServerClient()
  const { error } = await sb.from('workbook_state').upsert(
    { user_id: user.id, slug, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,slug' },
  )
  if (error) {
    const c = (error as { code?: string }).code
    if (c === '42P01' || c === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() })
}
