export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// Records one page view of the public site. Called by the tracker on the page itself, so it
// is deliberately open — but it can only ever increment a counter, never read anything, and
// everything it stores is non-personal (path, referrer host, mobile/desktop, the date).
//
// Writes go through the service role because page_stats has RLS with no policies: the anon
// key cannot touch the table, which keeps the numbers from being inflated or scraped.
// Silent by design: analytics must never surface an error to a visitor.
const OK = NextResponse.json({ ok: true })

function hostOf(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  try {
    return new URL(s.includes('//') ? s : `https://${s}`).host.replace(/^www\./, '').slice(0, 120)
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  // Casual-abuse guard: a browser sends Origin on a POST, so require it to be one of our own
  // hosts when present. Absent Origin is still allowed, so a stricter browser never silently
  // stops counting. Determined spoofing is possible but the only prize is a vanity number.
  const origin = req.headers.get('origin')
  if (origin) {
    let okOrigin = false
    try {
      const h = new URL(origin).hostname
      okOrigin = h === 'animatemple.com' || h.endsWith('.animatemple.com') || h === 'localhost' || h === '127.0.0.1'
    } catch { okOrigin = false }
    if (!okOrigin) return OK
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return OK }

  const slug = String(body.slug ?? '').trim().slice(0, 80)
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return OK

  // Path only — strip any query string so nothing a visitor typed is ever stored.
  let path = String(body.path ?? '/').split('?')[0].split('#')[0].slice(0, 200)
  if (!path.startsWith('/')) path = '/' + path

  const device = body.device === 'mobile' || body.device === 'desktop' ? body.device : 'other'

  const admin = getSupabaseAdmin()
  if (!admin) return OK
  try {
    await admin.rpc('record_page_view', {
      p_site: slug,
      p_path: path,
      p_ref: hostOf(body.ref),
      p_device: device,
      p_new_visit: body.newVisit === true,
    })
  } catch {
    // table/function not created yet, or a transient failure — never bother the visitor
  }
  return OK
}
