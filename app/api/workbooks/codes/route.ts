export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// A readable code alphabet — no 0/O/1/I/L ambiguity, so codes are easy to type
// off an Etsy message or a card.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode(): string {
  const arr = new Uint32Array(6)
  globalThis.crypto.getRandomValues(arr)
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[arr[i] % ALPHABET.length]
  return `TUNED-${s}`
}

// Owner-only: generate a batch of unlock codes for the workbook.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const { count } = await request.json()
    const n = Math.min(Math.max(parseInt(String(count), 10) || 0, 1), 200)
    const codes = Array.from({ length: n }, genCode)
    const supabase = createSupabaseServerClient()
    // ignoreDuplicates: on the astronomically-rare collision, skip rather than fail the batch.
    const { error } = await supabase
      .from('redeem_codes')
      .upsert(codes.map(code => ({ owner_id: user.id, code })), { onConflict: 'owner_id,code', ignoreDuplicates: true })
    if (error) {
      const c = (error as { code?: string }).code
      if (c === '42P01' || c === 'PGRST205') {
        return NextResponse.json({ error: 'The codes table isn’t set up yet. Run migration 023 in Supabase.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, codes })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
