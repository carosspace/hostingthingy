export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const em = (s: unknown) => String(s ?? '').trim().toLowerCase()

// A connected friend's AVAILABILITY — ONLY their booked blocks (start/end/label), and ONLY
// when there's an ACCEPTED link between us. Their tasks/notes/journal/etc. are never read out.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  const me = em(user.email)
  const friend = em(new URL(req.url).searchParams.get('email'))
  if (!friend) return NextResponse.json({ error: 'no email' }, { status: 400 })

  const sb = createSupabaseServerClient()
  // Consent gate: an accepted link between me + friend must exist (RLS only shows my links).
  const { data: a } = await sb.from('planner_links').select('id').eq('status', 'accepted').eq('requester_email', me).eq('addressee_email', friend).maybeSingle()
  let ok = !!a
  if (!ok) { const { data: b } = await sb.from('planner_links').select('id').eq('status', 'accepted').eq('requester_email', friend).eq('addressee_email', me).maybeSingle(); ok = !!b }
  if (!ok) return NextResponse.json({ error: 'not_connected' }, { status: 403 })

  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const { data: pd } = await admin.from('planner_data').select('data').ilike('email', friend).maybeSingle()
  const data = ((pd as { data?: Record<string, unknown> } | null)?.data) || {}
  const rawBlocks = (data.blocks as Record<string, unknown>) || {}

  // Strip to ONLY {start, end, label} — nothing else from the planner is exposed.
  const blocks: Record<string, { start: string; end: string; label: string }[]> = {}
  for (const k of Object.keys(rawBlocks)) {
    const arr = Array.isArray(rawBlocks[k]) ? (rawBlocks[k] as Record<string, unknown>[]) : []
    const cleaned = arr
      .map(b => ({ start: String(b.start || ''), end: String(b.end || ''), label: String(b.label || '').slice(0, 60) }))
      .filter(b => b.start && b.end)
    if (cleaned.length) blocks[k] = cleaned
  }
  return NextResponse.json({ email: friend, blocks })
}
