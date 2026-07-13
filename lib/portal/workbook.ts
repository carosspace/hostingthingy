import { createSupabaseServerClient } from '@/lib/supabase/server'

// The signed-in client's view of the portal workbook: its title, whether content
// exists, and whether THEY are entitled to open it. The owner is resolved
// server-side from the trusted slug by the RPC; the caller is matched by their
// verified JWT email. GRACEFUL: any error (e.g. migration 023 not applied) returns
// null so the page renders a gentle message instead of crashing.
export interface MyWorkbook {
  title: string
  hasContent: boolean
  entitled: boolean
}

export async function getMyWorkbook(slug: string, workbookSlug = 'tuned-in'): Promise<MyWorkbook | null> {
  try {
    const supabase = createSupabaseServerClient()
    let { data, error } = await supabase.rpc('get_my_workbook', { p_site_slug: slug, p_workbook_slug: workbookSlug })
    // Transitional: before migration 024 the RPC took only p_site_slug. If the 2-arg
    // call errors (function-signature mismatch) and we're asking for the original
    // 'tuned-in' workbook, retry the old 1-arg shape so Tuned In never goes dark.
    if (error && workbookSlug === 'tuned-in') {
      const retry = await supabase.rpc('get_my_workbook', { p_site_slug: slug })
      data = retry.data
      error = retry.error
    }
    if (error) {
      console.error('[workbook] get_my_workbook failed (migration 024 applied?):', error.message)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      title: String(row.title ?? 'Workbook'),
      hasContent: !!row.has_content,
      entitled: !!row.entitled,
    }
  } catch (e) {
    console.error('[workbook] get_my_workbook threw:', e)
    return null
  }
}

// Every workbook the owner offers, tagged with whether THIS member holds it. The
// portal lists the entitled + ready ones (each opens at /me/workbook?w=<slug>).
// GRACEFUL: [] on any error (e.g. migration 024 not applied).
export interface MyWorkbookListItem extends MyWorkbook {
  slug: string
  kind: 'workbook' | 'download'
  access: 'free' | 'members' | 'paid'
  hidden: boolean
  hasCompanion: boolean // an interactive workbook that also carries a printable companion file
}

export async function getMyWorkbooks(slug: string): Promise<MyWorkbookListItem[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_workbooks', { p_site_slug: slug })
    if (error) {
      // Transitional: before migration 024/025 there may be no get_my_workbooks / no kind
      // column. Fall back to the single 'tuned-in' workbook so Resources keeps working.
      const one = await getMyWorkbook(slug, 'tuned-in')
      if (one) return [{ slug: 'tuned-in', kind: 'workbook', access: 'paid', hidden: false, hasCompanion: false, ...one }]
      console.error('[workbook] get_my_workbooks failed (migration 024/025 applied?):', error.message)
      return []
    }
    const rows = Array.isArray(data) ? data : []
    return rows
      .map(r => ({
        slug: String(r.slug ?? ''),
        title: String(r.title ?? 'Workbook'),
        kind: (r.kind === 'download' ? 'download' : 'workbook') as 'workbook' | 'download',
        access: (r.access === 'free' || r.access === 'members' ? r.access : 'paid') as 'free' | 'members' | 'paid',
        hidden: !!r.hidden,
        hasContent: !!r.has_content,
        entitled: !!r.entitled,
        hasCompanion: !!r.has_companion,
      }))
      .filter(r => r.slug)
  } catch (e) {
    console.error('[workbook] get_my_workbooks threw:', e)
    return []
  }
}

// The gated download path for a file product — returned by the RPC ONLY when the caller
// is entitled (free / members / bought), else null. The caller turns it into a short-lived
// signed URL from the private site-resources bucket.
export interface MyDownload {
  filePath: string
  fileName: string | null
  mime: string | null
}

export async function getMyDownload(slug: string, workbookSlug: string): Promise<MyDownload | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_download_path', { p_site_slug: slug, p_workbook_slug: workbookSlug })
    if (error) { console.error('[workbook] get_my_download_path failed:', error.message); return null }
    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.file_path) return null
    return { filePath: String(row.file_path), fileName: (row.file_name as string) ?? null, mime: (row.mime as string) ?? null }
  } catch (e) {
    console.error('[workbook] get_my_download_path threw:', e)
    return null
  }
}

// The gated COMPANION file for an interactive workbook (e.g. a printable PDF) — returned by
// the RPC ONLY when the caller is entitled to the workbook, else null. Same delivery path as
// getMyDownload: the caller mints a short-lived signed URL from the private bucket.
export async function getMyWorkbookCompanion(slug: string, workbookSlug: string): Promise<MyDownload | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_workbook_companion', { p_site_slug: slug, p_workbook_slug: workbookSlug })
    if (error) { console.error('[workbook] get_my_workbook_companion failed:', error.message); return null }
    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.file_path) return null
    return { filePath: String(row.file_path), fileName: (row.file_name as string) ?? null, mime: (row.mime as string) ?? null }
  } catch (e) {
    console.error('[workbook] get_my_workbook_companion threw:', e)
    return null
  }
}

// The gated HTML for the workbook — returned by the RPC ONLY when the caller is
// entitled, else null. Used by the /api/client/workbook route to stream the page.
export async function getMyWorkbookHtml(slug: string, workbookSlug = 'tuned-in'): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_workbook_html', { p_site_slug: slug, p_workbook_slug: workbookSlug })
    if (error) {
      console.error('[workbook] get_my_workbook_html failed:', error.message)
      return null
    }
    return typeof data === 'string' && data.length > 0 ? data : null
  } catch (e) {
    console.error('[workbook] get_my_workbook_html threw:', e)
    return null
  }
}
