export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { listSites, saveSiteContent } from '@/lib/sites/store'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getPages } from '@/lib/sites/types'
import type { SiteContent, WorkbookProduct } from '@/lib/sites/types'
import { listOwnerProducts, productsToCardsHtml, spliceProductsRegion } from '@/lib/workbooks/products'

// Owner-only: delete a product completely — its DB row, everyone's access grants, its
// stored file (for a download), its landing page, and its library card.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  const slug = String(body.slug ?? '').toLowerCase().trim()
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return NextResponse.json({ error: 'Unknown item.' }, { status: 400 })

  const sites = await listSites().catch(() => null)
  if (!sites) return NextResponse.json({ error: 'Could not load your site.' }, { status: 500 })
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]
  if (!site) return NextResponse.json({ error: 'No website found on your account.' }, { status: 404 })
  const base = (site.content || {}) as SiteContent

  const sb = createSupabaseServerClient()
  // Grab the file path first (for storage cleanup), then remove the row + access grants (RLS-scoped).
  let filePath: string | null = null
  try {
    const { data } = await sb.from('workbooks').select('file_path').eq('owner_id', user.id).eq('slug', slug).maybeSingle()
    filePath = (data as { file_path?: string } | null)?.file_path ?? null
  } catch { /* table not migrated — nothing to remove */ }
  try { await sb.from('workbooks').delete().eq('owner_id', user.id).eq('slug', slug) } catch { /* ignore */ }
  try { await sb.from('workbook_access').delete().eq('owner_id', user.id).eq('slug', slug) } catch { /* ignore */ }

  // Remove the stored file from the private bucket (service role; best-effort).
  if (filePath) {
    const admin = getSupabaseAdmin()
    if (admin) { try { await admin.storage.from('site-resources').remove([filePath]) } catch { /* ignore */ } }
  }

  // Remove the product metadata + its landing page, then regenerate the library cards.
  const wp = { ...(base.workbookProducts || {}) } as Record<string, WorkbookProduct>
  delete wp[slug]
  const pages = getPages(base).filter(p => p.slug !== slug)
  const { products, workbooksOk } = await listOwnerProducts(user.id, { ...base, workbookProducts: wp })
  const resIdx = pages.findIndex(p => p.slug === 'resources')
  if (workbooksOk && resIdx >= 0 && pages[resIdx].fullHtml) {
    const spliced = spliceProductsRegion(pages[resIdx].fullHtml as string, productsToCardsHtml(products))
    if (spliced.ok) pages[resIdx] = { ...pages[resIdx], fullHtml: spliced.html }
  }

  try {
    await saveSiteContent(site.id, { ...base, pages, workbookProducts: wp })
  } catch (e) {
    return NextResponse.json({ error: 'Delete failed: ' + String((e as Error)?.message || e) }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
