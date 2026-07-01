export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// TEMP one-time: convert the home page from full-page HTML into a normal FREE-CANVAS
// page holding one "Custom HTML" box with the design — so it opens in the free canvas
// and the owner edits the HTML in that box's inspector. Token-gated. REMOVE after use.
const TOKEN = 'diag-7h3k9x2p'

export async function POST(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })
  try {
    const { data: site, error: e1 } = await admin.from('sites').select('id, content').eq('slug', 'animatemple-com').single()
    if (e1 || !site) return NextResponse.json({ error: 'site not found' }, { status: 404 })

    const content = (site.content || {}) as Record<string, unknown>
    const pages = (Array.isArray(content.pages) ? content.pages : []) as Record<string, unknown>[]
    const home = pages.find(p => String(p.slug ?? '') === '')
    if (!home) return NextResponse.json({ error: 'no home page' }, { status: 404 })

    const html = String(home.fullHtml ?? '')
    if (!html) return NextResponse.json({ error: 'home has no fullHtml to convert' }, { status: 400 })

    // One Custom HTML box (full canvas width, tall — she can resize) holding the design.
    const el = { id: 'homehtml', type: 'html', x: 0, y: 0, w: 1000, h: 4200, html, radius: 0 }
    home.canvas = { h: 4300, elements: [el], bg: '#efe6d9' }
    home.canvasHidden = false
    delete home.fullHtml
    content.pages = pages

    const { error: e2 } = await admin.from('sites').update({ content, updated_at: new Date().toISOString() }).eq('id', site.id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true, htmlLen: html.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
