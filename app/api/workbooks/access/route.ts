export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Owner-only: gift the workbook to a client by email (grant), or take it away
// (revoke). Access is matched to the member by their verified login email, so
// gifting an email that hasn't signed up yet still works — the workbook appears
// the moment they log into the portal with that email. RLS keeps each owner to
// their own rows.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const body = await request.json()
    const action = String(body.action || '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    const supabase = createSupabaseServerClient()

    if (action === 'grant') {
      const { error } = await supabase.from('workbook_access').upsert(
        { owner_id: user.id, client_email: email, source: 'gift' },
        { onConflict: 'owner_id,client_email', ignoreDuplicates: true },
      )
      if (error) {
        const c = (error as { code?: string }).code
        if (c === '42P01' || c === 'PGRST205') {
          return NextResponse.json({ error: 'The workbook table isn’t set up yet. Run migration 023 in Supabase.' }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'revoke') {
      const { error } = await supabase
        .from('workbook_access')
        .delete()
        .eq('owner_id', user.id)
        .eq('client_email', email)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
