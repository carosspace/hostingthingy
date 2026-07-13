export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const em = (s: unknown) => String(s ?? '').trim().toLowerCase()
const RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// List my planner connections, grouped: accepted, incoming invites, outgoing invites.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  const me = em(user.email)
  const sb = createSupabaseServerClient()
  const { data, error } = await sb.from('planner_links').select('id, requester_email, addressee_email, status')
  if (error) {
    const c = (error as { code?: string }).code
    if (c === '42P01' || c === 'PGRST205') return NextResponse.json({ error: 'not_ready' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const accepted: { id: string; email: string }[] = []
  const incoming: { id: string; email: string }[] = []
  const outgoing: { id: string; email: string }[] = []
  for (const r of data || []) {
    const other = em(r.requester_email) === me ? em(r.addressee_email) : em(r.requester_email)
    if (r.status === 'accepted') accepted.push({ id: r.id, email: other })
    else if (em(r.addressee_email) === me) incoming.push({ id: r.id, email: em(r.requester_email) })
    else outgoing.push({ id: r.id, email: em(r.addressee_email) })
  }
  return NextResponse.json({ me, accepted, incoming, outgoing })
}

// invite / accept / remove a connection by email (mutual consent).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  const me = em(user.email)
  let body: { action?: string; email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const action = String(body?.action || '')
  const other = em(body?.email)
  if (!RE.test(other)) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  if (other === me) return NextResponse.json({ error: 'That’s your own email.' }, { status: 400 })
  // Writes go through the service role, with the acting email (`me`) taken from the session
  // cookie — never from the request body. This is what stops a user forging a link that names
  // a stranger as a party. RLS blocks direct client writes entirely (see migration 027).
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  if (action === 'invite') {
    // If THEY already invited ME, connecting = accepting that. Else create a pending invite.
    const { data: rev } = await admin.from('planner_links').select('id').eq('requester_email', other).eq('addressee_email', me).maybeSingle()
    if (rev) { await admin.from('planner_links').update({ status: 'accepted' }).eq('id', (rev as { id: string }).id); return NextResponse.json({ ok: true, accepted: true }) }
    const { error } = await admin.from('planner_links').upsert({ requester_email: me, addressee_email: other, status: 'pending' }, { onConflict: 'requester_email,addressee_email', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'accept') {
    // Only the invited party (me = addressee) can accept, and only a pending invite.
    const { error } = await admin.from('planner_links').update({ status: 'accepted' }).eq('requester_email', other).eq('addressee_email', me).eq('status', 'pending')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'remove') {
    // Either side may disconnect: remove the link in whichever direction it exists, but only
    // pairs that involve me — `me` is always one of the two eq() filters.
    await admin.from('planner_links').delete().eq('requester_email', me).eq('addressee_email', other)
    await admin.from('planner_links').delete().eq('requester_email', other).eq('addressee_email', me)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
