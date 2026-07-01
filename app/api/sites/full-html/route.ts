export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSite, saveSiteContent } from '@/lib/sites/store'
import { getPages, type SiteContent } from '@/lib/sites/types'

// Owner-only: set (or clear) a page's `fullHtml` — a complete pasted design that
// renders as the whole page with no site chrome. A route handler (not a server
// action) so a large design isn't capped by the ~1MB server-action body limit.
// getSite/saveSiteContent are RLS-scoped to the owner, so a non-owner can't write.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const { siteId, pageSlug, html } = await req.json()
    if (!siteId) return NextResponse.json({ error: 'Missing site.' }, { status: 400 })

    const site = await getSite(String(siteId)) // null if not this owner's site (RLS)
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

    const value = typeof html === 'string' ? html.trim() : ''
    if (value.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'That HTML is too large (max ~4MB).' }, { status: 400 })
    }

    const base: SiteContent =
      site.content ?? { theme: 'sand', headline: '', subheadline: '', sections: [], contactEmail: '' }
    const slug = String(pageSlug ?? '')
    // Set fullHtml on the target page; empty clears it. Spread-preserve everything else (footgun).
    const pages = getPages(base).map(p => (p.slug === slug ? { ...p, fullHtml: value || undefined } : p))
    await saveSiteContent(String(siteId), { ...base, pages })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
