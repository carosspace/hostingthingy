export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'

// Redeem an unlock code from inside the planner gate. The redeem_code RPC is security-definer
// and matches the caller by their verified JWT email, granting access to the product the code
// was generated for (e.g. the planner). Returns a plain status the gate UI reacts to.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
  let body: { code?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const code = String(body?.code ?? '').trim()
  if (!code) return NextResponse.json({ status: 'invalid' })

  try {
    const sb = createSupabaseServerClient()
    const { data, error } = await sb.rpc('redeem_code', { p_site_slug: PORTAL_SITE_SLUG, p_code: code })
    if (error) {
      const c = (error as { code?: string }).code
      if (c === '42P01' || c === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
      return NextResponse.json({ status: 'error', error: error.message }, { status: 500 })
    }
    const status = (Array.isArray(data) ? data[0] : data) as string
    const ok = status === 'ok' || status === 'already'
    return NextResponse.json({ status: ['ok', 'already', 'invalid', 'error'].includes(status) ? status : 'error' }, { status: ok ? 200 : 200 })
  } catch (e) {
    return NextResponse.json({ status: 'error', error: String(e) }, { status: 500 })
  }
}
