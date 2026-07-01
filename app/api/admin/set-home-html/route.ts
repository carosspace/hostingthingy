export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// TEMP one-time setter: writes a page's `fullHtml` via the service role. Token-gated,
// non-destructive. REMOVE after use.
const TOKEN = 'diag-7h3k9x2p'

export async function POST(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  try {
    const body = await req.json()
    const siteSlug = String(body.slug || 'animatemple-com')
    const pageSlug = String(body.pageSlug ?? '')
    const html = body.html

    const { data: site, error: e1 } = await admin.from('sites').select('id, content').eq('slug', siteSlug).single()
    if (e1 || !site) return NextResponse.json({ error: 'site not found: ' + (e1?.message || siteSlug) }, { status: 404 })

    const content = (site.content || {}) as Record<string, unknown>
    const pages = (Array.isArray(content.pages) ? content.pages : []) as Record<string, unknown>[]
    let page = pages.find(p => String(p.slug ?? '') === pageSlug)
    if (!page) {
      page = { id: 'home', slug: pageSlug, title: 'Home', headline: '', subheadline: '', sections: [] }
      pages.unshift(page)
    }
    if (html === null || html === '') delete page.fullHtml
    else page.fullHtml = String(html)
    content.pages = pages

    const { error: e2 } = await admin.from('sites').update({ content, updated_at: new Date().toISOString() }).eq('id', site.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    return NextResponse.json({ ok: true, htmlLen: html ? String(html).length : 0 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
