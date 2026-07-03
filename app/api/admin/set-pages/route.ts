export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// TEMP one-time: upsert full-page-HTML pages onto the animatemple-com site (create missing
// pages, update existing ones' fullHtml). Used to publish the redesigned public site.
// Token-gated. REMOVE after use.
const TOKEN = 'diag-7h3k9x2p'

export async function POST(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  let body: { pages?: { slug: string; title?: string; fullHtml?: string }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const incoming = Array.isArray(body.pages) ? body.pages : []
  if (!incoming.length) return NextResponse.json({ error: 'no pages' }, { status: 400 })

  try {
    const { data: site, error: e1 } = await admin.from('sites').select('id, content').eq('slug', 'animatemple-com').single()
    if (e1 || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    const content = (site.content || {}) as Record<string, unknown>
    const pages = (Array.isArray(content.pages) ? content.pages : []) as Record<string, unknown>[]

    const results: string[] = []
    for (const inc of incoming) {
      const slug = String(inc.slug ?? '')
      const html = String(inc.fullHtml ?? '')
      if (!html) continue
      const existing = pages.find(p => String(p.slug ?? '') === slug)
      if (existing) {
        existing.fullHtml = html
        if (inc.title) existing.title = inc.title
        // fullHtml makes PublicPage render this design full-page (its own header/footer),
        // so drop any canvas so it can't be shown instead.
        delete existing.canvas
        delete existing.canvasHidden
        existing.hidden = false
        existing.offline = false
        results.push(`updated:${slug || 'home'}`)
      } else {
        pages.push({
          id: `pg-${slug || 'home'}-${pages.length + 1}`,
          slug,
          title: inc.title || slug || 'Page',
          navLabel: inc.title || undefined,
          fullHtml: html,
        })
        results.push(`created:${slug}`)
      }
    }
    content.pages = pages

    const { error: e2 } = await admin.from('sites').update({ content, updated_at: new Date().toISOString() }).eq('id', site.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true, results, pageCount: pages.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
