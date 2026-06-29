export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TEMPORARY one-off: set a site's content.brand, preserving all other content.
// Runs on the platform (uses its own service-role env — no secret leaves the box).
//   /api/admin/set-brand?token=diag-7h3k9x2p&slug=animatemple-com&brand=Anima%20Temple
// Remove after use.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('token') !== 'diag-7h3k9x2p') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const slug = request.nextUrl.searchParams.get('slug') || 'animatemple-com'
  const brand = (request.nextUrl.searchParams.get('brand') || 'Anima Temple').trim().slice(0, 80)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'missing supabase env', hasUrl: !!url, hasKey: !!key }, { status: 500 })

  const supa = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: site, error } = await supa.from('sites').select('id,slug,content').eq('slug', slug).maybeSingle()
  if (error) return NextResponse.json({ error: error.message })
  if (!site) {
    const { data: all } = await supa.from('sites').select('slug')
    return NextResponse.json({ error: 'site not found', slug, existingSlugs: (all || []).map((s) => s.slug) })
  }
  const oldBrand = (site.content && (site.content as { brand?: string }).brand) ?? null
  const content = { ...((site.content as object) || {}), brand }
  const { error: upErr } = await supa.from('sites').update({ content }).eq('id', site.id)
  if (upErr) return NextResponse.json({ error: upErr.message })
  return NextResponse.json({ ok: true, slug: site.slug, brandWas: oldBrand, brandNow: brand })
}
