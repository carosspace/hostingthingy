export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Owner-only: upsert the owner's single workbook (title, gating tier, and — when a
// new HTML file is provided — its content). Uses a route handler (not a server
// action) so the ~1MB HTML body isn't capped by the server-action size limit. RLS
// (auth.uid() = owner_id) keeps each owner to their own row.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const body = await request.json()
    const title = String(body.title ?? '').trim().slice(0, 200) || 'Workbook'
    const tierId = String(body.tierId ?? '').trim() || null
    const html = typeof body.html === 'string' ? body.html : null
    if (html !== null && html.length > 8_000_000) {
      return NextResponse.json({ error: 'That file is too large (max ~8MB).' }, { status: 400 })
    }
    // Which product this saves (an owner may have more than one workbook). Defaults to
    // the original 'tuned-in'. The upsert key must match the (owner_id, slug) primary key.
    const rawSlug = String(body.slug ?? 'tuned-in').toLowerCase()
    const slug = /^[a-z0-9-]{1,60}$/.test(rawSlug) ? rawSlug : 'tuned-in'

    const supabase = createSupabaseServerClient()
    // Config-only save (no new file) keeps the existing html_content untouched.
    const row: Record<string, unknown> = {
      owner_id: user.id,
      slug,
      title,
      tier_id: tierId,
      updated_at: new Date().toISOString(),
    }
    if (html !== null) row.html_content = html

    const { error } = await supabase.from('workbooks').upsert(row, { onConflict: 'owner_id,slug' })
    if (error) {
      const code = (error as { code?: string }).code
      if (code === '42P01' || code === 'PGRST205') {
        return NextResponse.json({ error: 'The workbook table isn’t set up yet. Run migration 023 in Supabase.' }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
