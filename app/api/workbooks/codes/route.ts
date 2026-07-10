export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// A readable code alphabet — no 0/O/1/I/L ambiguity, so codes are easy to type
// off an Etsy message or a card.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode(prefix: string): string {
  const arr = new Uint32Array(6)
  globalThis.crypto.getRandomValues(arr)
  let s = ''
  for (let i = 0; i < 6; i++) s += ALPHABET[arr[i] % ALPHABET.length]
  return `${prefix}-${s}`
}

// A short, readable code prefix per product (cosmetic — redemption matches on the whole
// code, not the prefix). Tuned In keeps its historical TUNED- prefix.
function prefixFor(slug: string): string {
  if (slug === 'tuned-in') return 'TUNED'
  const letters = slug.replace(/[^a-z]/gi, '').toUpperCase()
  return letters.slice(0, 4) || 'CODE'
}

// Owner-only: generate a batch of unlock codes for ONE product (defaults to 'tuned-in').
// Each code carries the product slug, so redeeming it grants THAT product.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const body = await request.json()
    const n = Math.min(Math.max(parseInt(String(body.count), 10) || 0, 1), 200)
    const rawSlug = String(body.slug ?? 'tuned-in').toLowerCase().trim()
    const slug = /^[a-z0-9-]{1,60}$/.test(rawSlug) ? rawSlug : 'tuned-in'
    const codes = Array.from({ length: n }, () => genCode(prefixFor(slug)))
    const supabase = createSupabaseServerClient()
    // ignoreDuplicates: on the astronomically-rare collision, skip rather than fail the batch.
    const { error } = await supabase
      .from('redeem_codes')
      .upsert(codes.map(code => ({ owner_id: user.id, code, slug })), { onConflict: 'owner_id,code', ignoreDuplicates: true })
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
